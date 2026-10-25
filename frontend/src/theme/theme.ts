import type { ThemeName } from '../api/types';

const THEME_KEY = 'moja.theme';

export const THEMES: ThemeName[] = ['dev-dark', 'dev-light'];

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}
