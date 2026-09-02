import { expect, test } from '@playwright/test'

test('renders the Spanish login surface directly', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  await expect(page.getByLabel('Correo electrónico')).toBeVisible()
  await expect(page.getByLabel('Contraseña')).toBeVisible()
})

test('redirects an unauthenticated visitor from a protected route', async ({
  page,
}) => {
  await page.goto('/calendar')

  const sessionError = page.getByRole('heading', {
    name: 'No pudimos comprobar tu sesión',
  })
  await expect
    .poll(
      async () => {
        if (page.url().endsWith('/login')) return 'login'
        if (await sessionError.isVisible()) return 'session-error'
        return 'waiting'
      },
      { timeout: 8000 },
    )
    .not.toBe('waiting')
  if (await sessionError.isVisible()) {
    test.skip(
      true,
      'El entorno E2E no pudo conectar con InsForge para comprobar la sesión.',
    )
  }

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
})
