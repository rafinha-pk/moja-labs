import { useState } from 'react';
import { pt } from '../../i18n/pt';
import type { TreeNode } from '../../lib/documents';

interface BranchProps {
  nodes: TreeNode[];
  depth: number;
  selected: string | null;
  closed: Set<string>;
  unsaved: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}

function Branch({
  nodes,
  depth,
  selected,
  closed,
  unsaved,
  onToggle,
  onSelect,
}: BranchProps) {
  const text = pt.docs.files;
  return (
    <ul>
      {nodes.map((node) => {
        const indent = { paddingLeft: `${0.75 + depth * 1}rem` };
        if (node.children.length > 0) {
          const shut = closed.has(node.path);
          return (
            <li key={node.path}>
              <button
                type="button"
                aria-expanded={!shut}
                onClick={() => onToggle(node.path)}
                style={indent}
                className="flex w-full items-center gap-1.5 py-1 pr-3 text-left text-sm font-semibold hover:bg-subtle"
              >
                <span aria-hidden="true" className="w-3 text-muted">
                  {shut ? '▸' : '▾'}
                </span>
                {node.name}
              </button>
              {!shut && (
                <Branch
                  nodes={node.children}
                  depth={depth + 1}
                  selected={selected}
                  closed={closed}
                  unsaved={unsaved}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              )}
            </li>
          );
        }
        const missing = node.entry !== null && !node.entry.exists;
        return (
          <li key={node.path}>
            <button
              type="button"
              aria-current={node.path === selected ? 'true' : undefined}
              onClick={() => onSelect(node.path)}
              style={indent}
              className={`flex w-full flex-wrap items-center gap-x-2 py-1 pr-3 text-left text-sm hover:bg-subtle ${
                node.path === selected ? 'bg-subtle font-semibold' : ''
              } ${missing ? 'text-muted' : ''}`}
            >
              <span aria-hidden="true" className="w-3" />
              {node.name}
              {node.entry?.required && (
                <span className="text-xs text-muted">
                  ({missing ? text.missing : text.required})
                </span>
              )}
              {node.path === unsaved && (
                <span className="text-xs text-muted">({text.unsaved})</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface DocTreeProps {
  nodes: TreeNode[];
  selected: string | null;
  unsaved: string | null;
  onSelect: (path: string) => void;
}

export function DocTree({ nodes, selected, unsaved, onSelect }: DocTreeProps) {
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const toggle = (path: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  return (
    <nav aria-label={pt.docs.files.tree} className="py-1">
      <Branch
        nodes={nodes}
        depth={0}
        selected={selected}
        closed={closed}
        unsaved={unsaved}
        onToggle={toggle}
        onSelect={onSelect}
      />
    </nav>
  );
}
