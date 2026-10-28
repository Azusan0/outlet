import type { Metadata } from 'next';

import './globals.css';

import { Toaster } from '@medusajs/ui';

import { HtmlLangSetter } from '@/components/atoms/HtmlLangSetter/HtmlLangSetter';
import { StorefrontTheme } from '@/components/organisms/StorefrontTheme/StorefrontTheme';
import { retrieveCart } from '@/lib/data/cart';
import { getTenant } from '@/lib/tenant';

import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    template: `%s | ${process.env.NEXT_PUBLIC_SITE_NAME || 'Outlet'}`,
    default: process.env.NEXT_PUBLIC_SITE_NAME || 'Outlet'
  },
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ||
    'Outlet 多租户独立设计集合店，连接商品、卖家与日常灵感。',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cart = await retrieveCart();
  const tenant = await getTenant().catch(() => null);

  // HtmlLangSetter follows the active route locale after hydration.
  const htmlLang = 'zh-CN';

  return (
    <html lang={htmlLang}>
      <body className="relative bg-primary text-secondary antialiased">
        <HtmlLangSetter />
        <StorefrontTheme>
          <Providers cart={cart} tenantSlug={tenant?.slug || 'north'}>
            {children}
          </Providers>
        </StorefrontTheme>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
