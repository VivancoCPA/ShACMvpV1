interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  danger?: boolean;
}

export function Switch({ id, checked, onChange, label, danger = false }: SwitchProps) {
  const trackColor = checked
    ? danger
      ? 'bg-error'
      : 'bg-coral'
    : 'bg-hairline dark:bg-surface-dark-elevated';

  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted dark:text-on-dark-soft"
    >
      <div className={`relative h-5 w-9 rounded-full transition-colors ${trackColor}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={onChange}
        className="sr-only"
        aria-checked={checked}
      />
      {label}
    </label>
  );
}
