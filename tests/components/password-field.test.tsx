import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasswordField, TextField } from '@/components/ui/form-field'

/**
 * Password masking contract.
 *
 * The reported symptom was "the password may be visible even though the icon
 * says it is hidden". These tests assert the actual rendered `type` attribute,
 * which is the only thing that decides whether a browser masks the value. They
 * are written against the real component, not a copy of its logic.
 */

describe('PasswordField — masking by default', () => {
  it('renders type="password" before any interaction', () => {
    render(<PasswordField label="Mot de passe" name="password" id="pw" />)
    const input = screen.getByLabelText(/^mot de passe/i)
    expect(input).toHaveAttribute('type', 'password')
  })

  it('exposes the toggle as not-pressed initially', () => {
    render(<PasswordField label="Mot de passe" name="password" id="pw" />)
    const toggle = screen.getByRole('button', { name: /afficher le mot de passe/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('never renders the value as plain text by default', () => {
    render(<PasswordField label="Mot de passe" name="password" id="pw" defaultValue="Secret123!" />)
    const input = screen.getByLabelText(/^mot de passe/i) as HTMLInputElement
    expect(input.type).toBe('password')
    // The value is present in the DOM (it must be, to submit) but the input type
    // guarantees the browser paints it masked.
    expect(input.value).toBe('Secret123!')
  })
})

describe('PasswordField — visibility toggle', () => {
  it('reveals the value on click and masks it again on a second click', async () => {
    const user = userEvent.setup()
    render(<PasswordField label="Mot de passe" name="password" id="pw" defaultValue="Secret123!" />)
    const input = screen.getByLabelText(/^mot de passe/i)

    await user.click(screen.getByRole('button', { name: /afficher le mot de passe/i }))
    expect(input).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /masquer le mot de passe/i }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('keeps the aria-label consistent with the current state', async () => {
    const user = userEvent.setup()
    render(<PasswordField label="Mot de passe" name="password" id="pw" />)

    // Masked -> the action offered is "show".
    expect(screen.getByRole('button', { name: /afficher/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await user.click(screen.getByRole('button', { name: /afficher/i }))

    // Revealed -> the action offered is "hide".
    const toggle = screen.getByRole('button', { name: /masquer/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('preserves the typed value across a toggle', async () => {
    const user = userEvent.setup()
    render(<PasswordField label="Mot de passe" name="password" id="pw" />)
    const input = screen.getByLabelText(/^mot de passe/i) as HTMLInputElement

    await user.type(input, 'MotDePasse1')
    expect(input.value).toBe('MotDePasse1')

    await user.click(screen.getByRole('button', { name: /afficher/i }))
    expect(input.value).toBe('MotDePasse1')

    await user.click(screen.getByRole('button', { name: /masquer/i }))
    expect(input.value).toBe('MotDePasse1')
  })

  it('does not submit the surrounding form when toggling', async () => {
    const user = userEvent.setup()
    let submitted = false
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submitted = true
        }}
      >
        <PasswordField label="Mot de passe" name="password" id="pw" />
      </form>,
    )

    await user.click(screen.getByRole('button', { name: /afficher/i }))
    // The toggle is type="button"; if it were the default "submit" the form
    // would fire on every eye click.
    expect(submitted).toBe(false)
  })
})

describe('PasswordField — cannot be rendered unmasked by a caller', () => {
  it('ignores a caller-supplied type="text"', () => {
    // Defence in depth: even if a future caller passes the wrong prop, the
    // component keeps the field masked.
    render(<PasswordField label="Mot de passe" name="password" id="pw" type="text" />)
    expect(screen.getByLabelText(/^mot de passe/i)).toHaveAttribute('type', 'password')
  })

  it('ignores a caller-supplied type="email"', () => {
    render(<PasswordField label="Mot de passe" name="password" id="pw" type="email" />)
    expect(screen.getByLabelText(/^mot de passe/i)).toHaveAttribute('type', 'password')
  })
})

describe('PasswordField — accessibility and errors', () => {
  it('links the error message to the input', () => {
    render(
      <PasswordField
        label="Mot de passe"
        name="password"
        id="pw"
        error="Le mot de passe est trop court."
      />,
    )
    const input = screen.getByLabelText(/^mot de passe/i)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'pw-error')
    expect(screen.getByText('Le mot de passe est trop court.')).toBeInTheDocument()
  })

  it('marks the field required for assistive technology', () => {
    render(<PasswordField label="Mot de passe" name="password" id="pw" required />)
    const input = screen.getByLabelText(/^mot de passe/i)
    expect(input).toBeRequired()
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  it('renders a hint when provided', () => {
    render(
      <PasswordField label="Mot de passe" name="password" id="pw" hint="10 caractères minimum." />,
    )
    expect(screen.getByText('10 caractères minimum.')).toBeInTheDocument()
  })
})

describe('TextField — control comparison', () => {
  it('does honour an explicit type, unlike PasswordField', () => {
    render(<TextField label="Adresse e-mail" name="email" id="email" type="email" />)
    expect(screen.getByLabelText(/adresse e-mail/i)).toHaveAttribute('type', 'email')
  })

  it('defaults to type="text"', () => {
    render(<TextField label="Nom" name="lastName" id="lastName" />)
    expect(screen.getByLabelText(/nom/i)).toHaveAttribute('type', 'text')
  })
})
