export type UsageTone = 'ok' | 'warning' | 'danger';

export function formatRemaining(milliseconds: number): string {
  const minutes = Math.ceil(milliseconds / 60000);
  if (minutes <= 0) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} d` : `${days} d ${restHours} h`;
}

export function usageTone(percent: number): UsageTone {
  if (percent >= 90) return 'danger';
  if (percent >= 70) return 'warning';
  return 'ok';
}
