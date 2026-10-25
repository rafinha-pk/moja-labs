import { pt } from '../../i18n/pt';

const SELECT =
  'min-w-0 rounded-md border border-line bg-inset px-2 py-1 text-sm text-fg disabled:opacity-60';

interface ModelSelectsProps {
  id: string;
  models: string[];
  efforts: string[];
  model: string | null;
  effort: string | null;
  thinking: boolean | null;
  inherit: boolean;
  disabled?: boolean;
  onChange: (
    patch: Partial<{
      model: string | null;
      effort: string | null;
      thinking: boolean | null;
    }>,
  ) => void;
}

export function ModelSelects({
  id,
  models,
  efforts,
  model,
  effort,
  thinking,
  inherit,
  disabled,
  onChange,
}: ModelSelectsProps) {
  const text = pt.tasks.options;
  const none = inherit ? <option value="">{text.useDefault}</option> : null;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label
        className="flex flex-col gap-1 text-xs text-muted"
        htmlFor={`${id}-model`}
      >
        {text.model}
        <select
          id={`${id}-model`}
          className={SELECT}
          disabled={disabled}
          value={model ?? ''}
          onChange={(event) => onChange({ model: event.target.value || null })}
        >
          {none}
          {models.map((item) => (
            <option key={item} value={item}>
              {text.models[item] ?? item}
            </option>
          ))}
        </select>
      </label>
      <label
        className="flex flex-col gap-1 text-xs text-muted"
        htmlFor={`${id}-effort`}
      >
        {text.effort}
        <select
          id={`${id}-effort`}
          className={SELECT}
          disabled={disabled}
          value={effort ?? ''}
          onChange={(event) => onChange({ effort: event.target.value || null })}
        >
          {none}
          {efforts.map((item) => (
            <option key={item} value={item}>
              {text.efforts[item] ?? item}
            </option>
          ))}
        </select>
      </label>
      <label
        className="flex flex-col gap-1 text-xs text-muted"
        htmlFor={`${id}-thinking`}
      >
        {text.thinking}
        <select
          id={`${id}-thinking`}
          className={SELECT}
          disabled={disabled}
          value={thinking === null ? '' : thinking ? 'on' : 'off'}
          onChange={(event) =>
            onChange({
              thinking:
                event.target.value === '' ? null : event.target.value === 'on',
            })
          }
        >
          {none}
          <option value="off">{text.thinkingOff}</option>
          <option value="on">{text.thinkingOn}</option>
        </select>
      </label>
    </div>
  );
}
