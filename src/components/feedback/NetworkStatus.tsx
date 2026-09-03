import { useEffect, useState } from 'react'

function getOnlineStatus() {
  return typeof navigator === 'undefined' || navigator.onLine
}

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(getOnlineStatus)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) {
    return null
  }

  return (
    <div
      aria-live="polite"
      className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-sm font-medium text-warning sm:px-6 lg:px-8"
      role="status"
    >
      Sin conexión. Comprueba tu conexión antes de guardar cambios.
    </div>
  )
}
