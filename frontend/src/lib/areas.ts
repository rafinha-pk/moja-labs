import type { Specialty } from '../api/types';

export const AREAS: Specialty[] = ['frontend', 'backend', 'fullstack'];

export function allowedAreas(specialty: Specialty): Specialty[] {
  return specialty === 'fullstack' ? AREAS : [specialty];
}
