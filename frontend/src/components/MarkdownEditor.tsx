import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { editorExtensions } from '../lib/editor';

interface MarkdownEditorProps {
  value: string;
  maxLength: number;
  label: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function MarkdownEditor({
  value,
  maxLength,
  label,
  onChange,
  onSave,
}: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onChange, onSave });
  handlers.current = { onChange, onSave };

  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: editorExtensions({
          maxLength,
          label,
          onChange: (next) => handlers.current.onChange(next),
          onSave: () => handlers.current.onSave(),
        }),
      }),
    });
    return () => view.destroy();
  }, []);

  return (
    <div
      ref={host}
      className="h-[65vh] overflow-hidden rounded-md border border-line"
    />
  );
}
