interface ImportMetaEnv {
  readonly VITE_INSFORGE_URL: string
  readonly VITE_INSFORGE_ANON_KEY: string
  readonly VITE_KARENDA_MCP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
