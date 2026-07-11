package vault

import (
	"bytes"
	"io"

	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/parser"
	"gopkg.in/yaml.v3"
)

// parseFrontmatter extracts the YAML frontmatter block from raw markdown
// content, if any. goldmark-meta only recognizes a "---" fence that starts
// on the very first line of the file; anything else (including a leading
// blank line) yields an empty map, not an error.
func parseFrontmatter(raw []byte) (map[string]interface{}, error) {
	md := goldmark.New(goldmark.WithExtensions(meta.Meta))

	ctx := parser.NewContext()
	if err := md.Convert(raw, io.Discard, parser.WithContext(ctx)); err != nil {
		return nil, err
	}

	fm, err := meta.TryGet(ctx)
	if err != nil {
		return nil, err
	}
	if fm == nil {
		return map[string]interface{}{}, nil
	}
	return fm, nil
}

// fenceOffsets scans raw for a frontmatter fence starting at byte 0 (same
// rule as parseFrontmatter/goldmark-meta). On success it returns the byte
// range of the inner YAML content [innerStart:innerEnd) and the offset
// right after the closing "---" line (where the block ends / body begins).
func fenceOffsets(raw []byte) (innerStart, innerEnd, afterFence int, ok bool) {
	firstLine, rest, firstOk := cutLine(raw)
	if !firstOk || !isDashLine(firstLine) {
		return 0, 0, 0, false
	}

	innerStart = len(raw) - len(rest)
	offset := innerStart
	remaining := rest
	for len(remaining) > 0 {
		line, next, lineOk := cutLine(remaining)
		lineLen := len(remaining) - len(next)
		if isDashLine(line) {
			return innerStart, offset, offset + lineLen, true
		}
		if !lineOk {
			break
		}
		offset += lineLen
		remaining = next
	}

	return 0, 0, 0, false
}

// SplitFrontmatter separates raw markdown content into its frontmatter
// block (the "---\n...\n---\n" fence, verbatim) and the body that follows
// it (with the single blank line conventionally separating them stripped).
// It applies the same "fence must start on byte 0" rule as parseFrontmatter
// so the two never disagree about whether a file has frontmatter; it does
// not care whether the YAML inside the fence is valid.
func SplitFrontmatter(raw []byte) (frontmatterBlock string, body string, hasFrontmatter bool) {
	_, _, afterFence, ok := fenceOffsets(raw)
	if !ok {
		return "", string(raw), false
	}

	block := raw[:afterFence]
	rest := raw[afterFence:]
	rest = bytes.TrimPrefix(rest, []byte("\r\n"))
	rest = bytes.TrimPrefix(rest, []byte("\n"))
	return string(block), string(rest), true
}

// FrontmatterInner returns just the YAML text between the fences (no
// "---" lines), for a raw/source view of a note's properties — e.g. an
// Obsidian-style "view as YAML" toggle in the property panel.
func FrontmatterInner(raw []byte) (inner string, hasFrontmatter bool) {
	innerStart, innerEnd, _, ok := fenceOffsets(raw)
	if !ok {
		return "", false
	}
	return string(raw[innerStart:innerEnd]), true
}

// cutLine splits off the first line of b (without its line terminator).
// ok is false when b has no newline (an unterminated final line).
func cutLine(b []byte) (line []byte, rest []byte, ok bool) {
	idx := bytes.IndexByte(b, '\n')
	if idx == -1 {
		return b, nil, false
	}
	end := idx
	if end > 0 && b[end-1] == '\r' {
		end--
	}
	return b[:end], b[idx+1:], true
}

func isDashLine(line []byte) bool {
	return string(line) == "---"
}

// ComposeNote serializes a frontmatter map and body back into one file's
// content, in the canonical "---\n<yaml>---\n\n<body>" shape. Unlike the
// original hand-written frontmatter block, this canonicalizes formatting
// (key order, quoting) via yaml.v3 — only the body is preserved verbatim.
func ComposeNote(frontmatter map[string]interface{}, body string) (string, error) {
	data, err := yaml.Marshal(frontmatter)
	if err != nil {
		return "", err
	}
	return "---\n" + string(data) + "---\n\n" + body, nil
}
