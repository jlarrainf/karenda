export function NotFoundPage() {
  return (
    <main
      className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-6 text-center"
      id="main-content"
    >
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Página no encontrada
      </h1>
      <p className="text-ink-muted">La dirección que intentaste visitar no existe.</p>
    </main>
  )
}
