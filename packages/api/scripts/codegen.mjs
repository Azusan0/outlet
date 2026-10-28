import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(apiDir, 'scripts/routes-manifest.json')
// Route types must be generated from a reviewed manifest at the pinned Mercur
// version, not from whichever code happens to be on the upstream canary branch.
if (!fs.existsSync(manifestPath)) {
  throw new Error(`Missing reviewed route manifest: ${manifestPath}`)
}
const cliPath = fileURLToPath(import.meta.resolve('@mercurjs/cli'))
const registerPath = pathToFileURL(path.join(apiDir, 'scripts/register-manifest.mjs')).href
const result = spawnSync(process.execPath, [cliPath, 'codegen'], {
  cwd: apiDir,
  env: {
    ...process.env,
    MERCUR_ROUTES_MANIFEST_URL: 'outlet:routes-manifest',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=${registerPath}`,
  },
  stdio: 'inherit',
})
process.exitCode = result.status ?? 1
