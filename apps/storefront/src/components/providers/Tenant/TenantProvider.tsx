"use client"

import { createContext, useContext, type PropsWithChildren } from "react"

const TenantContext = createContext("")

export function TenantProvider({
  slug,
  children,
}: PropsWithChildren<{ slug: string }>) {
  return <TenantContext.Provider value={slug}>{children}</TenantContext.Provider>
}

export function useTenantSlug() {
  return useContext(TenantContext)
}
