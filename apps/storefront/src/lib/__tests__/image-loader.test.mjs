import assert from 'node:assert/strict'
import test from 'node:test'

import { buildImageUrl } from '../image-loader.mjs'

test('prefixes local image sources once with the deployment base path', () => {
  process.env.NEXT_PUBLIC_BASE_PATH = '/outlet'

  assert.equal(
    buildImageUrl({ src: '/images/placeholder.svg', width: 64, quality: 75 }),
    '/outlet/images/placeholder.svg'
  )
  assert.equal(
    buildImageUrl({ src: '/outlet/images/placeholder.svg', width: 64 }),
    '/outlet/images/placeholder.svg'
  )
})

test('keeps remote image sources absolute in the optimizer request', () => {
  process.env.NEXT_PUBLIC_BASE_PATH = '/outlet'
  const source = 'https://example.com/image.jpg'

  assert.equal(
    buildImageUrl({ src: source, width: 320, quality: 80 }),
    source
  )
})
