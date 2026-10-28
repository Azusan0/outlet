import { HttpTypes } from "@medusajs/types"

import { CartDropdown, MobileNavbar, Navbar } from "@/components/cells"
import { UserDropdown } from "@/components/cells/UserDropdown/UserDropdown"
import CountrySelector from "@/components/molecules/CountrySelector/CountrySelector"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { MessageButton } from "@/components/molecules/MessageButton/MessageButton"
import { listCategories } from "@/lib/data/categories"
import { listRegions } from "@/lib/data/regions"
import { retrieveCustomer } from "@/lib/data/customer"
import { ParentCategoryLinks } from "@/components/molecules/ParentCategoryLinks/ParentCategoryLinks"
import { getStorefrontConfig, getTenantDirectory } from "@/lib/tenant"
import { TenantSwitch } from "../TenantSwitch/TenantSwitch"

export const Header = async ({ locale } : {
  locale: string
}) => {
  const user = await retrieveCustomer().catch(() => null)
  const isLoggedIn = Boolean(user)
  const { tenant, theme } = await getStorefrontConfig()
  const tenantDirectory = await getTenantDirectory().catch(() => [
    { slug: tenant.slug, name: tenant.name },
  ])

  const regions = await listRegions()

  const { categories, parentCategories } = (await listCategories({ query: { include_ancestors_tree: true } })) as {
    categories: HttpTypes.StoreProductCategory[]
    parentCategories: HttpTypes.StoreProductCategory[]
  }
  return (
    <header className="relative z-30" data-testid="header">
      <div
        className="flex items-center justify-between gap-4 overflow-hidden border-b px-4 py-2 outlet-rule lg:px-8"
        style={{ background: "var(--outlet-ink)", color: "var(--outlet-paper)" }}
      >
        <p className="outlet-eyebrow hidden truncate opacity-75 md:block">
          {theme.announcement}
        </p>
        <p className="outlet-eyebrow md:hidden">Outlet / {tenant.slug}</p>
        <TenantSwitch activeSlug={tenant.slug} tenants={tenantDirectory} />
      </div>
      <div
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4 py-4 lg:px-8 outlet-rule"
        data-testid="header-top"
      >
        <div className="flex min-w-0 items-center gap-5">
          <MobileNavbar
            parentCategories={parentCategories}
            categories={categories}
          />
          <ParentCategoryLinks
            parentCategories={parentCategories}
            categories={categories}
          />
        </div>
        <div className="flex items-center justify-center">
          <LocalizedClientLink
            href="/"
            className="group flex flex-col items-center leading-none"
            data-testid="header-logo-link"
          >
            <span className="text-[1.7rem] font-semibold tracking-[-0.08em]">
              OUTLET<span style={{ color: "var(--outlet-accent)" }}>.</span>
            </span>
            <span className="outlet-eyebrow mt-1 text-[0.55rem] opacity-55">
              {tenant.name}
            </span>
          </LocalizedClientLink>
        </div>
        <div className="flex items-center justify-end gap-3 lg:gap-5" data-testid="header-actions">
          <div className="hidden xl:block">
            <CountrySelector regions={regions} />
          </div>
          {isLoggedIn && <MessageButton />}
          <UserDropdown isLoggedIn={isLoggedIn} />
          <CartDropdown />
        </div>
      </div>
      <Navbar categories={categories} parentCategories={parentCategories} />
    </header>
  )
}
