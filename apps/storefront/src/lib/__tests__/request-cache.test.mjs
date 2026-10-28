import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCacheTag,
  normalizeCacheId,
} from '../request-cache.mjs'

const validId = 'f52780f5-bebe-4098-80a7-0dfd3fb63105'

test('accepts a UUID cache id without generating another one', () => {
  assert.equal(normalizeCacheId(validId, () => 'new-id'), validId)
})

test('replaces legacy or malformed cache ids', () => {
  assert.equal(normalizeCacheId(`north-${validId}`, () => 'new-id'), 'new-id')
  assert.equal(normalizeCacheId('', () => 'new-id'), 'new-id')
})

test('builds a bounded tenant-scoped cache tag', () => {
  assert.equal(
    buildCacheTag('customers', 'north', validId),
    `north-customers-${validId}`
  )
  assert.ok(buildCacheTag('customers', 'north', validId).length <= 256)
})
