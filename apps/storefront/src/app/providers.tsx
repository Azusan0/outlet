"use client"

import { CartProvider, TenantProvider } from "@/components/providers"
import { Cart } from "@/types/cart"
import type React from "react"

import { PropsWithChildren } from "react"

interface ProvidersProps extends PropsWithChildren {
  cart: Cart | null
  tenantSlug: string
}

export function Providers({ children, cart, tenantSlug }: ProvidersProps) {
  return (
    <TenantProvider slug={tenantSlug}>
      <CartProvider cart={cart}>{children}</CartProvider>
    </TenantProvider>
  )
}
