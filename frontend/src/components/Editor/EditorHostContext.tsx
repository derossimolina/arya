import { createContext, useContext } from 'react';

// App-level context custom block implementations need but that isn't part
// of BlockNote's own editor/document model: where a new page created from
// inside this note's body should live, how to navigate to a note once
// created/selected, and how to tell the sidebar tree (which has no file
// watcher yet) that a note was created outside its own +Nota/+Caderno flow.
// Populated by BlockEditor's caller (NoteEditor / TypedNoteView), which
// already know the note's own folder.
export interface EditorHost {
    parentPath: string;
    onOpenNote: (path: string) => void;
    onNoteCreated: () => void;
}

const EditorHostContext = createContext<EditorHost>({
    parentPath: '',
    onOpenNote: () => {},
    onNoteCreated: () => {},
});

export const EditorHostProvider = EditorHostContext.Provider;

export function useEditorHost(): EditorHost {
    return useContext(EditorHostContext);
}
