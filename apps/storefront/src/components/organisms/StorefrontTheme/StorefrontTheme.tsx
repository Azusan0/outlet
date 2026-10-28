import type { CSSProperties, ReactNode } from 'react'

import { getStorefrontConfig } from '@/lib/tenant'

const fallbackTheme = {
  accent: '#e45a36',
  paper: '#f3f0e8',
  ink: '#20211e',
}

export const StorefrontTheme = async ({
  children,
  fallback = false,
}: {
  children: ReactNode
  fallback?: boolean
}) => {
  const theme = fallback ? fallbackTheme : (await getStorefrontConfig()).theme
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
