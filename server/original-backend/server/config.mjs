import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const loadEnvFile = (filePath) => {
  if (!filePath || !existsSync(filePath)) return

  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]] !== undefined) continue

    const value = match[2].replace(/^(['"])(.*)\1$/, '$2')
    process.env[match[1]] = value
  }
}

for (const filePath of [
  process.env.BFF_ENV_FILE,
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../.env.local'),
  resolve(process.cwd(), '../.env'),
]) {
  loadEnvFile(filePath)
}

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const config = {
  host: process.env.BFF_HOST ?? '127.0.0.1',
  port: numberFromEnv('BFF_PORT', 8787),
  cacheTtlMs: numberFromEnv('BFF_CACHE_TTL_MS', 60_000),
  ors: {
    baseUrl: process.env.OPENROUTESERVICE_BASE_URL ?? 'https://api.openrouteservice.org',
    apiKey: process.env.OPENROUTESERVICE_API_KEY,
  },
  kma: {
    baseUrl: process.env.KMA_BASE_URL ?? 'https://apis.data.go.kr',
    apiKey: process.env.DATA_GO_KR_SERVICE_KEY ?? process.env.KMA_API_KEY,
  },
  ex: {
    baseUrl: process.env.EX_HIGHWAY_BASE_URL ?? 'https://data.ex.co.kr',
    apiKey: process.env.EX_HIGHWAY_API_KEY,
    apiKeyParam: process.env.EX_API_KEY_PARAM ?? 'key',
    travelTimeEndpoint: process.env.EX_TRAVEL_TIME_ENDPOINT,
    tollEndpoint: process.env.EX_TOLL_ENDPOINT,
    vmsEndpoint: process.env.EX_VMS_ENDPOINT ?? '/openapi/vms/vmsList',
  },
  ygpa: {
    baseUrl: process.env.YGPA_BASE_URL ?? 'https://apis.data.go.kr',
    apiKey: process.env.DATA_GO_KR_SERVICE_KEY ?? process.env.YGPA_API_KEY,
  },
  opinet: {
    apiKey: process.env.OPINET_API_KEY,
  },
}