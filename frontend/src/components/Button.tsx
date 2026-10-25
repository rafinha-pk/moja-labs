import type { ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'primary' | 'danger' | 'invisible';

const VARIANTS: Record<Variant, string> = {
  default: 'bg-control border-control-line text-fg hover:bg-control-hover',
  primary:
    'bg-success-emphasis border-transparent text-on-emphasis hover:bg-success-emphasis-hover',
  danger:
    'bg-control border-control-line text-danger hover:bg-danger-emphasis hover:text-on-emphasis hover:border-transparent',
  invisible:
    'bg-transparent border-transparent text-muted hover:bg-control-hover hover:text-fg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
}

export function Button({
  variant = 'default',
  small = false,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const size = small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-sm';
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${size} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
