import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import { restorePersistedAuthSession } from './lib/insforge/client.ts'
import './styles/index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('No se encontró el punto de montaje de la aplicación.')
}

const mountElement = rootElement

async function bootstrap(): Promise<void> {
  await restorePersistedAuthSession()
  createRoot(mountElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
