"use client"

import Link from "next/link"
import React, { MouseEventHandler } from "react"
import { useTenantSlug } from "@/components/providers"

/**
 * Use this component to create a Next.js `<LocalizedClientLink />` that persists the current country code in the url,
 * without having to explicitly pass it as a prop.
 */
const LocalizedClientLink = ({
  children,
  href,
  ...props
}: {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: MouseEventHandler<HTMLAnchorElement> | undefined
  passHref?: true
  [x: string]: any
}) => {
  const tenantSlug = useTenantSlug()
  const path = href === "/" ? "" : href.startsWith("/") ? href : `/${href}`

  return (
    <Link href={`/${tenantSlug}${path}`} {...props}>
      {children}
    </Link>
  )
}

export default LocalizedClientLink
