interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  0: RecognitionAlternative;
}

interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}

export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type RecognitionConstructor = new () => Recognition;

export function recognitionConstructor(): RecognitionConstructor | null {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function transcriptOf(results: ArrayLike<RecognitionResult>): string {
  return Array.from(results)
    .map((result) => result[0].transcript)
    .join('');
}

export function appendDictation(base: string, transcript: string): string {
  const spoken = transcript.trim();
  if (!spoken) return base;
  if (!base || /\s$/.test(base)) return `${base}${spoken}`;
  return `${base} ${spoken}`;
}
