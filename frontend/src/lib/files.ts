export const MAX_ATTACHMENT_BYTES = 10_000_000;
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ATTACHED_MARKER =
  '\n\nThe user attached these files; read them with the Read tool before answering:\n';
const ATTACHED_FOLDER = '.moja/anexos/';

export function splitAttachments(prompt: string): {
  text: string;
  files: string[];
} {
  const index = prompt.indexOf(ATTACHED_MARKER);
  if (index === -1) return { text: prompt, files: [] };
  const files = prompt
    .slice(index + ATTACHED_MARKER.length)
    .split('\n')
    .map((line) => line.replace(/^- /, '').trim())
    .filter((line) => line.startsWith(ATTACHED_FOLDER))
    .map((line) => line.slice(ATTACHED_FOLDER.length));
  return { text: prompt.slice(0, index), files };
}
