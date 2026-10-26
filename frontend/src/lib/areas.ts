import type { ProjectType, Specialty } from '../api/types';

export const AREAS: Specialty[] = ['frontend', 'backend', 'fullstack'];

export function allowedAreas(
  specialty: Specialty,
  type?: ProjectType,
): Specialty[] {
  if (type === 'mobile') return ['frontend'];
  return specialty === 'fullstack' ? AREAS : [specialty];
}
