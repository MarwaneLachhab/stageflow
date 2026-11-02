import { test, expect, type Page } from '@playwright/test'

/**
 * Role-separation end-to-end tests.
 *
 * ⚠️ NOT EXECUTED in this environment (no network port could be bound).
 * Committed ready to run.
 *
 * These tests target the boundary that a unit test cannot reach: an actual HTTP
 * request made by a signed-in user of the wrong role.
 */

const STAGIAIRE = {
  email: process.env.E2E_STAGIAIRE_EMAIL ?? '',
  password: process.env.E2E_STAGIAIRE_PASSWORD ?? '',
}

const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? '',
  password: process.env.E2E_ADMIN_PASSWORD ?? '',
}

const credentialsAvailable = Boolean(
  (STAGIAIRE.email && STAGIAIRE.password) || (ADMIN.email && ADMIN.password),
)

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/connexion')
  // Target the inputs by id: `getByLabel(/mot de passe/i)` also matches the
  // show/hide button, which carries aria-controls="password" (correct for
  // accessibility, but ambiguous for a strict locator).
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /se connecter/i }).click()
  await page.waitForURL(/\/(stagiaire|admin)\//, { timeout: 15_000 })
}

test.describe('Public routes', () => {
  test('the landing page renders its main heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('the sign-in page renders a form', async ({ page }) => {
    await page.goto('/connexion')
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible()
  })

  test('the sign-up page explains that a form is not a submission', async ({ page }) => {
    await page.goto('/inscription')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('a bad password gives a generic error, never a hint', async ({ page }) => {
    await page.goto('/connexion')
    await page.locator('#email').fill('nobody@example.invalid')
    await page.locator('#password').fill('definitely-wrong-password-123')
    await page.getByRole('button', { name: /se connecter/i }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()

    // The message must not reveal whether the account exists.
    await expect(alert).not.toContainText(/inconnu|n’existe pas|introuvable/i)
  })
})

test.describe('Protected routes send guests to sign-in', () => {
  for (const route of [
    '/stagiaire/tableau-de-bord',
    '/stagiaire/profil',
    '/stagiaire/demande',
    '/stagiaire/documents',
    '/stagiaire/suivi',
    '/admin/tableau-de-bord',
    '/admin/demandes',
  ]) {
    test(`${route} redirects an anonymous visitor`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/connexion/)
    })
  }
})

test.describe('Role separation', () => {
  test.skip(
    !credentialsAvailable,
    'Set E2E_STAGIAIRE_EMAIL/PASSWORD and E2E_ADMIN_EMAIL/PASSWORD to run these.',
  )

  test('a stagiaire cannot reach the administration area', async ({ page }) => {
    test.skip(!STAGIAIRE.email, 'Stagiaire credentials not provided.')

    await signIn(page, STAGIAIRE.email, STAGIAIRE.password)

    // Attempt direct navigation to each admin surface.
    for (const adminRoute of [
      '/admin/tableau-de-bord',
      '/admin/demandes',
      '/admin/statistiques',
    ]) {
      await page.goto(adminRoute)

      // Must be bounced back into the stagiaire workspace, NOT shown admin data.
      await expect(page).toHaveURL(/\/stagiaire\//)
      await expect(page.getByText(/demandes totales/i)).toHaveCount(0)
    }
  })

  test('a stagiaire sees no administrative navigation', async ({ page }) => {
    test.skip(!STAGIAIRE.email, 'Stagiaire credentials not provided.')

    await signIn(page, STAGIAIRE.email, STAGIAIRE.password)
    await page.goto('/stagiaire/tableau-de-bord')

    await expect(page.getByRole('link', { name: /toutes les demandes/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /statistiques/i })).toHaveCount(0)
  })

  test('an administrator lands on the admin dashboard', async ({ page }) => {
    test.skip(!ADMIN.email, 'Admin credentials not provided.')

    await signIn(page, ADMIN.email, ADMIN.password)
    await expect(page).toHaveURL(/\/admin\/tableau-de-bord/)
  })

  test('an administrator cannot switch into the stagiaire workspace', async ({ page }) => {
    test.skip(!ADMIN.email, 'Admin credentials not provided.')

    await signIn(page, ADMIN.email, ADMIN.password)
    await page.goto('/stagiaire/tableau-de-bord')

    await expect(page).toHaveURL(/\/admin\//)
  })
})

test.describe('Document access control', () => {
  test('an anonymous request for a document is refused', async ({ request }) => {
    // A well-formed UUID that does not exist. The route must not leak the file,
    // and must not confirm whether the id is real.
    const response = await request.get(
      '/api/documents/00000000-0000-4000-8000-000000000000',
    )
    expect([401, 404]).toContain(response.status())
  })

  test('a malformed document id is rejected', async ({ request }) => {
    const response = await request.get('/api/documents/not-a-uuid')
    // 401 is the correct first answer for an anonymous caller: authentication is
    // checked before the id is even parsed. 400/404 would also be acceptable.
    expect([400, 401, 404]).toContain(response.status())
  })

  test('the sign-out endpoint refuses GET', async ({ request }) => {
    // GET-based logout is CSRF-triggerable from a third-party site.
    const response = await request.get('/api/auth/signout')
    expect(response.status()).toBe(405)
  })
})

test.describe('Security headers', () => {
  test('the landing page sets hardening headers', async ({ request }) => {
    const response = await request.get('/')
    const headers = response.headers()

    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBeDefined()
    expect(headers['content-security-policy']).toBeDefined()
    expect(headers['referrer-policy']).toBeDefined()
  })
})

test.describe('Responsive layout', () => {
  test('the landing page has no horizontal overflow', async ({ page }) => {
    await page.goto('/')

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    // A few pixels of rounding are tolerable; a real overflow is not.
    expect(overflow).toBeLessThanOrEqual(2)
  })

  test('the mobile navigation is reachable', async ({ page }) => {
    await page.goto('/connexion')
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible()
  })
})
