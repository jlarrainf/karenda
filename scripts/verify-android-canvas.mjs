import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const assetsDirectory = resolve(import.meta.dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'public', 'assets')
const scriptFiles = readdirSync(assetsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => readFileSync(resolve(assetsDirectory, entry.name), 'utf8'))

const requiredCanvasLabels = [
  'Sincronizar Canvas',
  'Abrir en Canvas',
  'Bandeja de revisión',
  'Seminario',
]

const missingLabels = requiredCanvasLabels.filter((label) => (
  !scriptFiles.some((content) => content.includes(label))
))

if (missingLabels.length > 0) {
  console.error(`Los assets Android no contienen la superficie Canvas esperada: ${missingLabels.join(', ')}.`)
  process.exit(1)
}

console.log('Los assets Android contienen la ruta Canvas, la bandeja y las categorías confirmables.')
