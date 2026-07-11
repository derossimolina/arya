import { vault } from '../../../wailsjs/go/models';

interface TreeProps {
    nodes: vault.Node[];
    expanded: Set<string>;
    onToggleFolder: (path: string) => void;
    selectedFolder: string;
    onSelectFolder: (path: string) => void;
    activeNotePath: string | null;
    onOpenNote: (path: string) => void;
    depth?: number;
}

function Tree({
    nodes,
    expanded,
    onToggleFolder,
    selectedFolder,
    onSelectFolder,
    activeNotePath,
    onOpenNote,
    depth = 0,
}: TreeProps) {
    return (
        <ul className="tree" style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
            {nodes.map((node) => {
                if (node.type === 'folder') {
                    const isExpanded = expanded.has(node.path);
                    const isSelected = selectedFolder === node.path;
                    return (
                        <li key={node.path}>
                            <div
                                className={`tree-row folder${isSelected ? ' selected' : ''}`}
                                onClick={() => {
                                    onToggleFolder(node.path);
                                    onSelectFolder(node.path);
                                }}
                            >
                                <span className="tree-caret">{isExpanded ? '▾' : '▸'}</span>
                                <span className="tree-icon">📁</span>
                                <span className="tree-name">{node.name}</span>
                            </div>
                            {isExpanded && node.children && node.children.length > 0 && (
                                <Tree
                                    nodes={node.children}
                                    expanded={expanded}
                                    onToggleFolder={onToggleFolder}
                                    selectedFolder={selectedFolder}
                                    onSelectFolder={onSelectFolder}
                                    activeNotePath={activeNotePath}
                                    onOpenNote={onOpenNote}
                                    depth={depth + 1}
                                />
                            )}
                        </li>
                    );
                }

                const isActive = activeNotePath === node.path;
                return (
                    <li key={node.path}>
                        <div
                            className={`tree-row note${isActive ? ' active' : ''}`}
                            onClick={() => onOpenNote(node.path)}
                        >
                            <span className="tree-icon">📝</span>
                            <span className="tree-name">{node.name.replace(/\.md$/i, '')}</span>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

export default Tree;
