import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.karenda.android',
  appName: 'Karenda',
  backgroundColor: '#F5F6F2',
  loggingBehavior: 'none',
  server: {
    androidScheme: 'https',
  },
  webDir: 'dist',
  android: {
    backgroundColor: '#F5F6F2',
    loggingBehavior: 'none',
    webContentsDebuggingEnabled: false,
  },
}

export default config
