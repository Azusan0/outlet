import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { getStorefrontConfig } from "@/lib/tenant"

const serviceLinks = [
  { label: "全部商品", path: "/categories" },
  { label: "购物袋", path: "/cart" },
  { label: "我的订单", path: "/user/orders" },
  { label: "配送地址", path: "/user/addresses" },
]

const aboutLinks = [
  { label: "店铺首页", path: "/" },
  { label: "账户设置", path: "/user/settings" },
  { label: "隐私与条款", path: "#" },
]

export async function Footer() {
  const { tenant } = await getStorefrontConfig()

  return (
    <footer
      className="mt-16 border-t px-4 pb-8 pt-12 lg:px-8 outlet-rule"
      data-testid="footer"
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-12 border-b pb-14 lg:grid-cols-[1.5fr_0.65fr_0.65fr] outlet-rule">
          <div>
            <p className="outlet-eyebrow mb-5 opacity-55">Independent marketplace</p>
            <p className="outlet-display max-w-[8ch] text-[clamp(3.5rem,7vw,7rem)]">
              OUTLET<span style={{ color: "var(--outlet-accent)" }}>.</span>
            </p>
            <p className="mt-6 max-w-md text-sm leading-7 opacity-70">
              {tenant.name} 是由独立卖家共同组成的精选商店。少而准确的选择，
              让每件商品都有被继续使用的理由。
            </p>
          </div>

          <nav aria-label="客户服务">
            <h2 className="outlet-eyebrow mb-5">客户服务</h2>
            <div className="space-y-3">
              {serviceLinks.map(({ label, path }) => (
                <LocalizedClientLink
                  key={label}
                  href={path}
                  className="outlet-link block w-fit text-sm"
                >
                  {label}
                </LocalizedClientLink>
              ))}
            </div>
          </nav>

          <nav aria-label="关于 Outlet">
            <h2 className="outlet-eyebrow mb-5">关于</h2>
            <div className="space-y-3">
              {aboutLinks.map(({ label, path }) => (
                <LocalizedClientLink
                  key={label}
                  href={path}
                  className="outlet-link block w-fit text-sm"
                >
                  {label}
                </LocalizedClientLink>
              ))}
            </div>
          </nav>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-xs opacity-60 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Outlet. 多租户独立商店演示。</p>
          <p>商品、库存与履约由独立卖家提供。</p>
        </div>
      </div>
    </footer>
  )
}
