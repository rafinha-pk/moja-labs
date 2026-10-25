export interface RepositoryDraft {
  name: string;
  description: string;
  visibility: 'private' | 'public';
}

export function repositorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function defaultDraft(projectName: string): RepositoryDraft {
  return {
    name: repositorySlug(projectName),
    description: '',
    visibility: 'private',
  };
}

export function draftPayload(draft: RepositoryDraft) {
  return {
    name: draft.name,
    description: draft.description,
    private: draft.visibility === 'private',
  };
}
