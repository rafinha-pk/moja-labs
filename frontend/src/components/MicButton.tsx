import { useEffect, useRef, useState } from 'react';
import { pt } from '../i18n/pt';
import {
  appendDictation,
  recognitionConstructor,
  transcriptOf,
  type Recognition,
} from '../lib/dictation';
import { Button } from './Button';

const AUTO_SEND_KEY = 'moja.dictation.autosend';

function readAutoSend(): boolean {
  try {
    return localStorage.getItem(AUTO_SEND_KEY) === '1';
  } catch {
    return false;
  }
}

interface MicButtonProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}

export function MicButton({
  value,
  disabled,
  onChange,
  onSend,
}: MicButtonProps) {
  const text = pt.dictation;
  const Recognizer = recognitionConstructor();
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [autoSend, setAutoSend] = useState(readAutoSend);
  const recognition = useRef<Recognition | null>(null);
  const latest = useRef({ text: '', heard: false });
  const handlers = useRef({ onChange, onSend, autoSend });
  handlers.current = { onChange, onSend, autoSend };

  useEffect(() => () => recognition.current?.stop(), []);

  if (!Recognizer) return null;

  const toggleAutoSend = (checked: boolean) => {
    setAutoSend(checked);
    try {
      localStorage.setItem(AUTO_SEND_KEY, checked ? '1' : '0');
    } catch {
      /* the choice just is not remembered */
    }
  };

  const start = () => {
    setProblem(null);
    const base = value;
    latest.current = { text: base, heard: false };
    const engine = new Recognizer();
    engine.lang = 'pt-BR';
    engine.continuous = true;
    engine.interimResults = true;
    engine.onresult = (event) => {
      const spoken = transcriptOf(event.results);
      latest.current = {
        text: appendDictation(base, spoken),
        heard: spoken.trim() !== '',
      };
      handlers.current.onChange(latest.current.text);
    };
    engine.onerror = (event) => {
      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed'
      ) {
        setProblem(text.denied);
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setProblem(text.failed);
      }
    };
    engine.onend = () => {
      setListening(false);
      recognition.current = null;
      const { text: finalText, heard } = latest.current;
      if (heard && handlers.current.autoSend && finalText.trim()) {
        handlers.current.onSend(finalText);
      }
    };
    recognition.current = engine;
    setListening(true);
    engine.start();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        small
        disabled={disabled}
        aria-pressed={listening}
        variant={listening ? 'danger' : 'default'}
        onClick={() => (listening ? recognition.current?.stop() : start())}
      >
        <MicIcon />
        {listening ? text.stop : text.start}
      </Button>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input
          type="checkbox"
          checked={autoSend}
          onChange={(event) => toggleAutoSend(event.target.checked)}
        />
        {text.autoSend}
      </label>
      {listening && (
        <span className="text-xs text-muted">{text.listening}</span>
      )}
      {problem && <span className="text-xs text-danger">{problem}</span>}
    </div>
  );
}
