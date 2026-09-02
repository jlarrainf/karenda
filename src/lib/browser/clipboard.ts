export async function copyTextToClipboard(value: string): Promise<void> {
  const clipboard = globalThis.navigator?.clipboard

  if (!clipboard) {
    throw new Error('El portapapeles no está disponible.')
  }

  await clipboard.writeText(value)
}
