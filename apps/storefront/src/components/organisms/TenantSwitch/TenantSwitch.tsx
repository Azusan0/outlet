import Link from "next/link"

export type TenantLink = {
  slug: string
  name: string
}

export const TenantSwitch = ({
  activeSlug,
  tenants,
}: {
  activeSlug: string
  tenants: TenantLink[]
}) => (
  <nav className="flex gap-5" aria-label="切换店铺">
    {tenants.map((tenant) => (
      <Link
        key={tenant.slug}
        href={`/${tenant.slug}`}
        className={`outlet-link text-xs ${activeSlug === tenant.slug ? "font-semibold" : "opacity-50"}`}
        aria-current={activeSlug === tenant.slug ? "page" : undefined}
      >
        {tenant.name}
      </Link>
    ))}
  </nav>
)
