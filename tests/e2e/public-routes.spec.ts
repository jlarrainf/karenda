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

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
})
