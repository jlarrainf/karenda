import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = resolve(import.meta.dirname, '..')
const androidRoot = resolve(projectRoot, 'android')
const isWindows = process.platform === 'win32'
const gradleWrapper = resolve(androidRoot, isWindows ? 'gradlew.bat' : 'gradlew')
const apkPath = resolve(androidRoot, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

if (!existsSync(gradleWrapper)) {
  console.error('No se encontró el wrapper de Gradle para Android.')
  process.exit(1)
}

function javaHomeCandidates() {
  if (process.env.JAVA_HOME?.trim()) return [process.env.JAVA_HOME.trim()]

  if (isWindows) {
    return [
      process.env.ANDROID_STUDIO_JAVA_HOME,
      'C:\\Program Files\\Android\\Android Studio\\jbr',
    ].filter(Boolean)
  }

  if (process.platform === 'darwin') {
    return [
      process.env.ANDROID_STUDIO_JAVA_HOME,
      '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    ].filter(Boolean)
  }

  return [
    process.env.ANDROID_STUDIO_JAVA_HOME,
    '/opt/android-studio/jbr',
    '/opt/android-studio/jre',
  ].filter(Boolean)
}

const environment = { ...process.env }
if (!environment.JAVA_HOME) {
  const javaHome = javaHomeCandidates().find((candidate) => {
    const executable = resolve(candidate, 'bin', isWindows ? 'java.exe' : 'java')
    return existsSync(executable)
  })

  if (javaHome) environment.JAVA_HOME = javaHome
}

if (!environment.JAVA_HOME) {
  console.error('No se encontró un JDK compatible. Define JAVA_HOME o ANDROID_STUDIO_JAVA_HOME.')
  process.exit(1)
}

console.log('Generando APK debug de Karenda con los assets locales de Canvas…')
const result = spawnSync(
  gradleWrapper,
  [':app:assembleDebug', '--no-daemon'],
  {
    cwd: androidRoot,
    env: environment,
    shell: isWindows,
    stdio: 'inherit',
  },
)

if (result.error) {
  console.error(`No se pudo iniciar Gradle: ${result.error.message}`)
  process.exit(1)
}

if (result.status !== 0) process.exit(result.status ?? 1)
if (!existsSync(apkPath)) {
  console.error('Gradle terminó sin generar la APK debug esperada.')
  process.exit(1)
}

console.log(`APK debug disponible en ${apkPath}`)
