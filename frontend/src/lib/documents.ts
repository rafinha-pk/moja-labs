import type { DocumentEntry } from '../api/types';

export interface TreeNode {
  name: string;
  path: string;
  entry: DocumentEntry | null;
  children: TreeNode[];
}

export function documentPath(name: string): string {
  const parts = name
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/\.md$/, '')
    .replace(/^docs\//, '')
    .split('/')
    .map((part) => part.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean);
  return parts.length ? `docs/${parts.join('/')}.md` : '';
}

function rank(node: TreeNode): number {
  if (node.path === 'README.md') return 0;
  if (node.children.length > 0) return 1;
  return node.entry?.required ? 2 : 3;
}

function sortTree(node: TreeNode): void {
  node.children.sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name),
  );
  node.children.forEach(sortTree);
}

export function buildTree(entries: DocumentEntry[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', entry: null, children: [] };
  for (const entry of entries) {
    const parts = entry.path.split('/');
    let node = root;
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/');
      let child = node.children.find((item) => item.path === path);
      if (!child) {
        child = { name: part, path, entry: null, children: [] };
        node.children.push(child);
      }
      if (index === parts.length - 1) child.entry = entry;
      node = child;
    });
  }
  sortTree(root);
  return root.children;
}
