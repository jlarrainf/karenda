import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readLocalEnvironment() {
  try {
    return readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
      .split(/\r?\n/)
      .reduce((values, line) => {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)

        if (match) {
          values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
        }

        return values
      }, {})
  } catch {
    return {}
  }
}

const localEnvironment = readLocalEnvironment()

function getEnvironmentValue(name) {
  return process.env[name]?.trim() || localEnvironment[name]?.trim()
}

const requiredVariables = ['VITE_INSFORGE_URL', 'VITE_INSFORGE_ANON_KEY']

const missingVariables = requiredVariables.filter((name) => {
  const value = getEnvironmentValue(name)

  return !value || value === 'replace-with-your-insforge-anon-key'
})

if (missingVariables.length > 0) {
  console.error(
    `Falta configurar InsForge para Android. Define ${missingVariables.join(', ')} en .env.local y vuelve a ejecutar la compilación.`,
  )
  process.exit(1)
}

try {
  const url = new URL(getEnvironmentValue('VITE_INSFORGE_URL'))

  if (url.protocol !== 'https:') {
    throw new Error('La URL de InsForge debe usar HTTPS.')
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'La URL no es válida.'

  console.error(`Configuración de InsForge inválida: ${message}`)
  process.exit(1)
}

console.log('Configuración de InsForge encontrada. Preparando APK Android.')
