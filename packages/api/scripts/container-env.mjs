import fs from "node:fs"

// The public deployment keeps databases on a private network. Rewrite only
// the disposable container config; host-side credentials remain untouched.
const databaseUrl = new URL(process.env.DATABASE_URL)
if (process.env.DATABASE_HOST) databaseUrl.hostname = process.env.DATABASE_HOST
if (process.env.DATABASE_PORT) databaseUrl.port = process.env.DATABASE_PORT
process.env.DATABASE_URL = databaseUrl.toString()
if (process.env.REDIS_HOST) process.env.REDIS_URL = `redis://${process.env.REDIS_HOST}:6379`

const names = [
  "DATABASE_URL", "REDIS_URL", "NODE_ENV", "JWT_SECRET", "COOKIE_SECRET",
  "STORE_CORS", "ADMIN_CORS", "VENDOR_CORS", "AUTH_CORS", "MERCUR_VENDOR_URL",
  "STOREFRONT_REVALIDATE_URL", "STOREFRONT_REVALIDATE_SECRET", "FILE_BACKEND_URL",
  "DEMO_ADMIN_EMAIL", "DEMO_ADMIN_PASSWORD", "AI_BASE_URL", "AI_API_KEY", "AI_MODEL",
  "AI_TIMEOUT_MS", "AI_MAX_ITERATIONS", "AI_MAX_TOKENS", "AI_TEMPERATURE",
  "ERP_WEBHOOK_URL", "ERP_WEBHOOK_TOKEN", "ERP_SIMULATE",
]
const lines = names.filter((name) => process.env[name]).map((name) => `${name}=${process.env[name]}`)
fs.writeFileSync(".env", lines.join("\n"), { mode: 0o600 })
