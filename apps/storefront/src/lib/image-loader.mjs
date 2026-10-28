function normalizeBasePath(value) {
  return (value || '').replace(/\/+$/, '')
}

export function buildImageUrl({ src, width, quality }) {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)
  const source =
    src.startsWith('/') && basePath && !src.startsWith(`${basePath}/`)
      ? `${basePath}${src}`
      : src

  return source
}

export default function imageLoader(props) {
  return buildImageUrl(props)
}
