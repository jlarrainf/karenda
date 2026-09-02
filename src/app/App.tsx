import { RouterProvider } from 'react-router-dom'
import { isInsForgeConfigured } from '../lib/insforge/client.ts'
import { appRouter } from './routes.tsx'

function ConfigurationPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-12 text-ink">
      <section
        aria-labelledby="configuration-title"
        className="w-full max-w-xl rounded-panel border border-border bg-surface p-6 shadow-overlay sm:p-8"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand">
          Karenda
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight" id="configuration-title">
          Falta configurar InsForge
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Crea un archivo <code className="font-semibold text-ink">.env.local</code> en
          la raíz del proyecto con la URL y la clave anónima de InsForge. Después
          reinicia el servidor de desarrollo.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-control bg-surface-subtle p-4 text-xs leading-6 text-ink">
          <code>
            {
              'VITE_INSFORGE_URL=https://tu-proyecto.insforge.app\nVITE_INSFORGE_ANON_KEY=tu-anon-key'
            }
          </code>
        </pre>
      </section>
    </main>
  )
}

function App() {
  if (!isInsForgeConfigured) {
    return <ConfigurationPage />
  }

  return <RouterProvider router={appRouter} />
}

export default App
