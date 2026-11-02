'use client'

import { forwardRef, useId, useState } from 'react'
import { Eye, EyeOff, Search } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { FieldError } from '@/components/ui/alert'

/**
 * Form primitives.
 *
 * Every control owns its label, hint and error association
 * (`aria-describedby` / `aria-invalid`), which is what the accessibility
 * checklist verifies. They all share `.sf-input` so heights and focus rings are
 * identical across the whole application.
 */

type BaseProps = {
  label: string
  name: string
  hint?: string
  error?: string
  required?: boolean
  containerClassName?: string
}

/* -------------------------------------------------------------------------- */
/* Text / email / tel / date                                                   */
/* -------------------------------------------------------------------------- */

export const TextField = forwardRef<
  HTMLInputElement,
  BaseProps & React.InputHTMLAttributes<HTMLInputElement>
>(function TextField(
  { label, name, hint, error, required, containerClassName, className, type = 'text', ...rest },
  ref,
) {
  const generatedId = useId()
  const id = rest.id ?? `${name}-${generatedId}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={cn('min-w-0', containerClassName)}>
      <label htmlFor={id} className="sf-label">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sf-sr-only">(obligatoire)</span>}
      </label>
      <input
        ref={ref}
        id={id}
        name={name}
        type={type}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hintId, errorId) || undefined}
        className={cn('sf-input', type === 'date' && 'text-ink', className)}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="sf-hint">
          {hint}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
})

/* -------------------------------------------------------------------------- */
/* Password with visibility toggle                                             */
/* -------------------------------------------------------------------------- */

export const PasswordField = forwardRef<
  HTMLInputElement,
  BaseProps & React.InputHTMLAttributes<HTMLInputElement>
>(function PasswordField(
  { label, name, hint, error, required, containerClassName, className, ...rest },
  ref,
) {
  const generatedId = useId()
  const id = rest.id ?? `${name}-${generatedId}`
  const [visible, setVisible] = useState(false)
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={cn('min-w-0', containerClassName)}>
      <label htmlFor={id} className="sf-label">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sf-sr-only">(obligatoire)</span>}
      </label>
      <div className="relative">
        {/*
          `type` is set AFTER the spread on purpose. If a caller passes
          `type="text"` (or anything else) it is ignored, so this control can
          never be rendered unmasked by accident. Masking is the default and the
          only way to reveal the value is the explicit toggle below.
        */}
        <input
          {...rest}
          ref={ref}
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(hintId, errorId) || undefined}
          className={cn('sf-input pr-11', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle transition-colors hover:text-ink"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {hint && !error && (
        <p id={hintId} className="sf-hint">
          {hint}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
})

/* -------------------------------------------------------------------------- */
/* Select                                                                      */
/* -------------------------------------------------------------------------- */

export const SelectField = forwardRef<
  HTMLSelectElement,
  BaseProps & React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }
>(function SelectField(
  { label, name, hint, error, required, containerClassName, className, options, ...rest },
  ref,
) {
  const generatedId = useId()
  const id = rest.id ?? `${name}-${generatedId}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={cn('min-w-0', containerClassName)}>
      <label htmlFor={id} className="sf-label">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sf-sr-only">(obligatoire)</span>}
      </label>
      <select
        ref={ref}
        id={id}
        name={name}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hintId, errorId) || undefined}
        className={cn('sf-select', className)}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && !error && (
        <p id={hintId} className="sf-hint">
          {hint}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
})

/* -------------------------------------------------------------------------- */
/* Textarea with character counter                                             */
/* -------------------------------------------------------------------------- */

export const TextareaField = forwardRef<
  HTMLTextAreaElement,
  BaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement> & { maxLength?: number; showCount?: boolean }
>(function TextareaField(
  { label, name, hint, error, required, containerClassName, className, maxLength, showCount, value, ...rest },
  ref,
) {
  const generatedId = useId()
  const id = rest.id ?? `${name}-${generatedId}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const count = typeof value === 'string' ? value.length : 0

  return (
    <div className={cn('min-w-0', containerClassName)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="sf-label">
          {label}
          {required && (
            <span className="ml-1 text-danger" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sf-sr-only">(obligatoire)</span>}
        </label>
        {showCount && maxLength && (
          <span
            className={cn(
              'mb-1.5 text-xs tabular-nums',
              count > maxLength * 0.9 ? 'font-semibold text-warning' : 'text-ink-subtle',
            )}
          >
            {count} / {maxLength}
          </span>
        )}
      </div>
      <textarea
        ref={ref}
        id={id}
        name={name}
        required={required}
        maxLength={maxLength}
        value={value}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hintId, errorId) || undefined}
        className={cn('sf-textarea', className)}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="sf-hint">
          {hint}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
})

/* -------------------------------------------------------------------------- */
/* Checkbox                                                                    */
/* -------------------------------------------------------------------------- */

export function CheckboxField({
  label,
  name,
  error,
  className,
  ...rest
}: {
  label: React.ReactNode
  name: string
  error?: string
  className?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId()
  const id = rest.id ?? `${name}-${generatedId}`
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          name={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border-strong text-primary-600 accent-primary-600 focus-visible:ring-2 focus-visible:ring-primary-600/40 focus-visible:ring-offset-1"
          {...rest}
        />
        <label htmlFor={id} className="cursor-pointer text-sm leading-snug text-ink-muted">
          {label}
        </label>
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Search input                                                                */
/* -------------------------------------------------------------------------- */

export function SearchField({
  value,
  onChange,
  placeholder = 'Rechercher…',
  label = 'Rechercher',
  className,
  onClear,
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
  onClear?: () => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  const id = useId()

  return (
    <div className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sf-sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="sf-input pl-10"
        {...rest}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Effacer la recherche"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink"
        >
          Effacer
        </button>
      )}
    </div>
  )
}
