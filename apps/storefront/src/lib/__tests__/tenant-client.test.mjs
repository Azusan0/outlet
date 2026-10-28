import assert from "node:assert/strict"
import { after, test } from "node:test"
import { createClient } from "@mercurjs/client"
import {
  createTenantScopedClient,
  withTenantRequestContext,
} from "../tenant-client.mjs"

const originalFetch = globalThis.fetch

after(() => {
  globalThis.fetch = originalFetch
})

test("overrides caller keys and adds tenant cache tags without mutation", () => {
  const input = {
    fetchOptions: {
      cache: "force-cache",
      headers: {
        authorization: "Bearer customer-token",
        "x-publishable-api-key": "untrusted-key",
      },
      next: { revalidate: 45, tags: ["products"] },
    },
  }

  const scoped = withTenantRequestContext(input, {
    slug: "north",
    publishable_key: "north-public-key",
  })

  assert.deepEqual(scoped.fetchOptions.headers, {
    authorization: "Bearer customer-token",
    "x-publishable-api-key": "north-public-key",
  })
  assert.deepEqual(scoped.fetchOptions.next, {
    revalidate: 45,
    tags: ["products", "tenant-north"],
  })
  assert.equal(input.fetchOptions.headers["x-publishable-api-key"], "untrusted-key")
})

test("real SDK requests keep concurrent tenants and caches isolated", async () => {
  const tenants = [
    { slug: "north", publishable_key: "north-public-key" },
    { slug: "field", publishable_key: "field-public-key" },
  ]
  const requests = []
  let tenantIndex = 0

  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init.headers)
    requests.push({
      url: String(input),
      key: headers.get("x-publishable-api-key"),
      tags: init.next?.tags ?? [],
    })
    return new Response(JSON.stringify({ tenants: [] }), {
      headers: { "content-type": "application/json" },
    })
  }

  const sdk = createTenantScopedClient(
    createClient({ baseUrl: "http://outlet.test" }),
    async () => tenants[tenantIndex++]
  )

  await Promise.all([
    sdk.store.tenants.query({
      fetchOptions: { cache: "force-cache", next: { tags: ["directory"] } },
    }),
    sdk.store.tenants.query({
      fetchOptions: { cache: "force-cache", next: { tags: ["directory"] } },
    }),
  ])

  assert.equal(requests.length, 2)
  assert.deepEqual(
    requests.map((request) => request.key).sort(),
    ["field-public-key", "north-public-key"]
  )
  assert.deepEqual(
    requests.map((request) => request.tags).sort((a, b) => a[1].localeCompare(b[1])),
    [
      ["directory", "tenant-field"],
      ["directory", "tenant-north"],
    ]
  )
  assert.ok(requests.every((request) => request.url === "http://outlet.test/store/tenants"))
})
