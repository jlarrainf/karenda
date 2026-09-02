import { expect, test } from '@playwright/test'

const testEmail = process.env.KARENDA_E2E_EMAIL
const testPassword = process.env.KARENDA_E2E_PASSWORD

test('authenticated user can navigate the four calendar views and notes', async ({
  page,
}) => {
  test.skip(
    !testEmail || !testPassword,
    'Configura KARENDA_E2E_EMAIL y KARENDA_E2E_PASSWORD con una cuenta de prueba.',
  )

  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(testEmail!)
  await page.getByLabel('Contraseña').fill(testPassword!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/calendar$/)

  const toolbar = page.locator('.calendar-panel .fc-header-toolbar')
  const toolbarTitle = page.locator('.calendar-panel .fc-toolbar-title')
  await expect(toolbarTitle).toBeVisible()

  const toolbarBox = await toolbar.boundingBox()
  const titleBox = await toolbarTitle.boundingBox()

  if (!toolbarBox || !titleBox) {
    throw new Error('No se pudo medir el toolbar del calendario.')
  }

  expect(titleBox.x + titleBox.width / 2).toBeCloseTo(
    toolbarBox.x + toolbarBox.width / 2,
    0,
  )

  for (const view of ['Agenda', 'Mes', 'Semana', 'Día']) {
    await page.getByRole('button', { name: view, exact: true }).click()
    await expect(page.getByRole('button', { name: view, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }

  await page.goto('/notes')
  await expect(page.getByRole('heading', { name: 'Notas Markdown' })).toBeVisible()

  await page.goto('/habits')
  await expect(page.getByRole('heading', { name: 'Hábitos' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Tareas recurrentes', exact: true }),
  ).toBeVisible()
})
