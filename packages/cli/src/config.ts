import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export type ShadowCTXConfig =
  | { backend: 'sqlite'; dbPath: string }
  | { backend: 'supabase'; accessToken: string; refreshToken: string; userId: string }

export function configPath(): string {
  return path.join(os.homedir(), '.config', 'shadowctx', 'config.json')
}

export function loadConfig(): ShadowCTXConfig | null {
  const p = configPath()
  if (!fs.existsSync(p)) return null
  try {
    const raw = fs.readFileSync(p, 'utf8')
    return JSON.parse(raw) as ShadowCTXConfig
  } catch {
    return null
  }
}

export function saveConfig(cfg: ShadowCTXConfig): void {
  const p = configPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const tmp = p + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
  fs.renameSync(tmp, p)
}
