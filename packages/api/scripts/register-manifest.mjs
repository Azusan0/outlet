import fs from 'node:fs'

const nativeFetch = globalThis.fetch
const manifest = fs.readFileSync(new URL('./routes-manifest.json', import.meta.url), 'utf8')

globalThis.fetch = async (input, init) => {
  if (String(input) === 'outlet:routes-manifest') {
    return new Response(manifest, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  return nativeFetch(input, init)
}
