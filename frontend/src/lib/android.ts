export interface AndroidLevel {
  api: number;
  name: string;
}

export const DEFAULT_MIN_SDK = 24;

export const ANDROID_LEVELS: AndroidLevel[] = [
  { api: 24, name: 'Android 7.0' },
  { api: 25, name: 'Android 7.1' },
  { api: 26, name: 'Android 8.0' },
  { api: 27, name: 'Android 8.1' },
  { api: 28, name: 'Android 9' },
  { api: 29, name: 'Android 10' },
  { api: 30, name: 'Android 11' },
  { api: 31, name: 'Android 12' },
  { api: 32, name: 'Android 12L' },
  { api: 33, name: 'Android 13' },
  { api: 34, name: 'Android 14' },
  { api: 35, name: 'Android 15' },
];

export const DEFAULT_ABIS = ['arm64-v8a'];

export const ANDROID_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86'];

export function toggleAbi(current: string[], abi: string): string[] {
  const next = current.includes(abi)
    ? current.filter((item) => item !== abi)
    : [...current, abi];
  return ANDROID_ABIS.filter((item) => next.includes(item));
}

export function sameAbis(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

export function androidName(api: number): string {
  const level = ANDROID_LEVELS.find((item) => item.api === api);
  return level ? level.name : `API ${api}`;
}

export function isValidPackage(value: string): boolean {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value);
}
