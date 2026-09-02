import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  isLoading?: boolean
  loadingLabel?: string
  variant?: ButtonVariant
}

const variantClassNames: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-surface hover:bg-brand-strong focus-visible:ring-brand-soft',
  secondary:
    'border border-border-strong bg-surface text-brand hover:bg-brand-soft focus-visible:ring-brand-soft',
  ghost:
    'text-ink-muted hover:bg-surface-strong hover:text-ink focus-visible:ring-brand-soft',
  danger: 'bg-danger text-surface hover:bg-danger/90 focus-visible:ring-danger-soft',
}

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  loadingLabel = 'Guardando…',
  type = 'button',
  variant = 'primary',
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      {...buttonProps}
      aria-busy={isLoading || undefined}
      className={[
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold transition-colors duration-state focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
        variantClassNames[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || isLoading}
      type={type}
    >
      {isLoading ? <span aria-live="polite">{loadingLabel}</span> : children}
    </button>
  )
}
