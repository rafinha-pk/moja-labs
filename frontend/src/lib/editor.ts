import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';

const highlight = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--syntax-heading)', fontWeight: '600' },
  { tag: tags.strong, color: 'var(--syntax-strong)', fontWeight: '700' },
  { tag: tags.emphasis, color: 'var(--syntax-emphasis)', fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--syntax-link)' },
  { tag: tags.url, color: 'var(--syntax-url)', textDecoration: 'underline' },
  { tag: tags.monospace, color: 'var(--syntax-code)' },
  { tag: tags.quote, color: 'var(--syntax-quote)' },
  { tag: tags.processingInstruction, color: 'var(--syntax-marker)' },
  { tag: tags.contentSeparator, color: 'var(--syntax-marker)' },
  { tag: tags.comment, color: 'var(--syntax-comment)' },
  { tag: tags.tagName, color: 'var(--syntax-tag)' },
  { tag: tags.angleBracket, color: 'var(--syntax-marker)' },
  { tag: tags.attributeName, color: 'var(--syntax-attribute)' },
  { tag: tags.attributeValue, color: 'var(--syntax-code)' },
]);

const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--bg-inset)',
    color: 'var(--fg-default)',
    fontSize: '14px',
  },
  '&.cm-focused': {
    outline: '2px solid var(--accent-emphasis)',
    outlineOffset: '-1px',
  },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--fg-default)', padding: '8px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fg-default)' },
  '.cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'var(--selection)',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'var(--selection)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-inset)',
    color: 'var(--fg-muted)',
    border: 'none',
  },
  '.cm-activeLine': { backgroundColor: 'var(--active-line)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--active-line)',
    color: 'var(--fg-default)',
  },
});

interface EditorOptions {
  maxLength: number;
  label: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function editorExtensions({
  maxLength,
  label,
  onChange,
  onSave,
}: EditorOptions): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    drawSelection(),
    history(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(highlight),
    theme,
    keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          onSave();
          return true;
        },
      },
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
    EditorState.transactionFilter.of((transaction) =>
      transaction.newDoc.length > maxLength ? [] : transaction,
    ),
    EditorView.contentAttributes.of({
      'aria-label': label,
      spellcheck: 'false',
    }),
  ];
}
