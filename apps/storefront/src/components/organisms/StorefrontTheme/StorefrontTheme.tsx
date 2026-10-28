import type { CSSProperties, ReactNode } from 'react'

import { getStorefrontConfig } from '@/lib/tenant'

export const StorefrontTheme = async ({ children }: { children: ReactNode }) => {
  const { theme } = await getStorefrontConfig()
  const style = {
    '--outlet-paper': theme.paper,
    '--outlet-ink': theme.ink,
    '--outlet-accent': theme.accent,
  } as CSSProperties

  return (
    <div className="outlet-theme min-h-screen" style={style}>
      {children}
    </div>
  )
}
