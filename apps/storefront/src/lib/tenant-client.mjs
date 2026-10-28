export function withTenantRequestContext(input, tenant) {
  const fetchOptions = input.fetchOptions ?? {}
  const headers = new Headers(fetchOptions.headers)
  headers.set("x-publishable-api-key", tenant.publishable_key)

  const next = fetchOptions.next
  const shouldTagCache = fetchOptions.cache === "force-cache" || Boolean(next)

  return {
    ...input,
    fetchOptions: {
      ...fetchOptions,
      headers: Object.fromEntries(headers.entries()),
      ...(shouldTagCache
        ? {
            next: {
              ...next,
              revalidate: next?.revalidate ?? 300,
              tags: [...new Set([...(next?.tags ?? []), `tenant-${tenant.slug}`])],
            },
          }
        : {}),
    },
  }
}

export function createTenantScopedClient(client, resolveTenant) {
  const wrap = (target) =>
    new Proxy(target, {
      get(current, property, receiver) {
        const member = Reflect.get(current, property, receiver)
        return typeof member === "function" ? wrap(member) : member
      },
      apply(current, thisArg, args) {
        return resolveTenant().then((tenant) => {
          const input =
            args[0] && typeof args[0] === "object" ? args[0] : {}
          const scopedInput = withTenantRequestContext(input, tenant)
          return Reflect.apply(current, thisArg, [scopedInput, ...args.slice(1)])
        })
      },
    })

  return wrap(client)
}
