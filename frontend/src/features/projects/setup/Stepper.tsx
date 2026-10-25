import { pt } from '../../../i18n/pt';
import type { StepId, StepState, WizardStep } from '../../../lib/wizard';

const CIRCLE: Record<StepState, string> = {
  done: 'border-transparent bg-success-emphasis text-on-emphasis',
  skipped: 'border-transparent bg-line-muted text-muted',
  current: 'border-transparent bg-accent-emphasis text-on-emphasis',
  locked: 'border-line text-muted',
};

const MARK: Partial<Record<StepState, string>> = {
  done: '✓',
  skipped: '–',
};

export function Stepper({
  steps,
  active,
  onSelect,
}: {
  steps: WizardStep[];
  active: StepId;
  onSelect: (id: StepId) => void;
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const reachable = step.state !== 'locked';
        const selected = step.id === active;
        return (
          <li key={step.id}>
            <button
              type="button"
              disabled={!reachable}
              aria-current={selected ? 'step' : undefined}
              onClick={() => onSelect(step.id)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? 'border-accent-emphasis bg-subtle'
                  : 'border-line hover:bg-control-hover'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${CIRCLE[step.state]}`}
              >
                {MARK[step.state] ?? index + 1}
              </span>
              <span className="font-medium">
                {pt.setup.wizard.stepTitles[step.id]}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
