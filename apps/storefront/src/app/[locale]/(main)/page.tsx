import type { Metadata } from "next"
import Image from "next/image"
import Script from "next/script"
import { headers } from "next/headers"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { HomeCategories } from "@/components/sections/HomeCategories/HomeCategories"
import { HomeProductsCarousel } from "@/components/organisms"
import { getStorefrontConfig } from "@/lib/tenant"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const config = await getStorefrontConfig().catch(() => null)
  const headersList = await headers()
  const host = headersList.get("host")
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
  const tenantSlug = config?.tenant.slug || "north"
  const siteName = config?.tenant.name || "Outlet"
  const title = `${siteName} | 独立设计精选`
  const description =
    config?.tenant.description ||
    "Outlet 多租户独立设计集合店，连接商品、卖家与日常灵感。"

  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/${tenantSlug}`,
      languages: { "zh-CN": `${baseUrl}/${tenantSlug}` },
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${tenantSlug}`,
      siteName,
      locale: locale === "de" ? "zh_CN" : locale,
      type: "website",
    },
    robots: { index: true, follow: true },
  }
}

export default async function Home() {
  const { tenant, page } = await getStorefrontConfig()
  const headersList = await headers()
  const host = headersList.get("host")
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
  const configuredHero = page.hero_image || "/images/hero/Image.jpg"
  const heroImage = configuredHero.endsWith("/north-hero.jpg")
    ? configuredHero.replace(/\.jpg$/, ".svg")
    : configuredHero.endsWith("/field-hero.jpg")
      ? configuredHero.replace(/\.jpg$/, ".svg")
      : configuredHero

  return (
    <main className="text-[var(--outlet-ink)]">
      <Script
        id="ld-org"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Outlet",
            url: baseUrl,
          }),
        }}
      />

      <section className="mx-auto grid max-w-[1440px] gap-8 px-4 pb-14 pt-7 md:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12 lg:pb-20 lg:pt-10">
        <div className="outlet-reveal relative min-h-[54vh] overflow-hidden bg-[color-mix(in_srgb,var(--outlet-ink)_8%,transparent)] lg:min-h-[720px]">
          <Image
            src={heroImage}
            alt={`${tenant.name} 本期精选`}
            fill
            priority
            fetchPriority="high"
            quality={82}
            sizes="(min-width: 1024px) 54vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/55 to-transparent p-5 text-white">
            <span className="outlet-eyebrow">Selected by {tenant.name}</span>
            <span className="outlet-eyebrow opacity-70">Issue 01 / 2026</span>
          </div>
        </div>

        <div className="flex flex-col justify-between py-2 lg:py-5">
          <div className="outlet-reveal outlet-reveal-delay">
            <div className="mb-8 flex items-center gap-3">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: "var(--outlet-accent)" }}
              />
              <p className="outlet-eyebrow">{page.eyebrow}</p>
            </div>
            <h1 className="outlet-display whitespace-pre-line">
              {page.headline}
            </h1>
            <p className="mt-8 max-w-[31rem] text-base leading-8 opacity-70 md:text-lg md:leading-9">
              {page.subheading}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <LocalizedClientLink
                href="/categories"
                className="inline-flex min-h-12 items-center bg-[var(--outlet-ink)] px-6 text-sm font-medium text-[var(--outlet-paper)] transition-transform hover:-translate-y-0.5"
              >
                浏览本期精选
              </LocalizedClientLink>
              <a
                href="#service-promise"
                className="inline-flex min-h-12 items-center border px-6 text-sm font-medium transition-colors hover:bg-[var(--outlet-ink)] hover:text-[var(--outlet-paper)] outlet-rule"
              >
                我们如何选品
              </a>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-3 border-t pt-5 outlet-rule">
            {[
              ["独立卖家", "Seller-led"],
              ["精选库存", "Small runs"],
              ["多卖家拆单", "One checkout"],
            ].map(([label, note]) => (
              <div key={label} className="border-r pr-3 last:border-r-0 last:pl-3 outlet-rule">
                <p className="text-xs font-semibold">{label}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] opacity-45">
                  {note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y px-4 py-14 md:px-8 lg:py-20 outlet-rule">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-9 flex items-end justify-between gap-5">
            <div>
              <p className="outlet-eyebrow mb-3 opacity-50">Just landed / 04</p>
              <h2 className="outlet-section-title">本周新到</h2>
            </div>
            <LocalizedClientLink
              href="/categories"
              className="outlet-link mb-1 hidden text-xs font-semibold sm:block"
            >
              查看全部商品
            </LocalizedClientLink>
          </div>
          <HomeProductsCarousel
            locale={tenant.default_country || "de"}
            sellerProducts={[]}
            home
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-16 md:px-8 lg:py-24">
        <HomeCategories heading="按品类浏览" />
      </section>

      <section
        id="service-promise"
        className="mx-4 grid overflow-hidden md:mx-8 lg:grid-cols-[0.8fr_1.2fr]"
        style={{ background: "var(--outlet-ink)", color: "var(--outlet-paper)" }}
      >
        <div className="flex flex-col justify-between p-7 md:p-12 lg:p-14">
          <div>
            <p className="outlet-eyebrow mb-8 opacity-55">The Outlet standard</p>
            <h2 className="outlet-section-title max-w-[8ch]">
              少一点，但更准确。
            </h2>
          </div>
          <p className="mt-16 max-w-sm text-sm leading-7 opacity-65">
            我们把商品、卖家与订单拆分成清晰的服务边界。每家店保留自己的库存与履约，
            买家只面对一次顺畅的结账体验。
          </p>
        </div>
        <div className="grid border-t lg:border-l lg:border-t-0 outlet-rule">
          {[
            ["01", "独立卖家供货", "商品归属与库存由卖家维护，平台统一展示和交易。"],
            ["02", "一次购物车，多卖家履约", "同一订单组自动拆分为卖家订单，配送状态分别追踪。"],
            ["03", "主题化多租户", "店铺内容、视觉和商品范围按租户隔离，共享同一套交易能力。"],
          ].map(([index, title, body]) => (
            <div
              key={index}
              className="grid gap-4 border-b p-7 last:border-b-0 sm:grid-cols-[3rem_1fr] md:p-10 outlet-rule"
            >
              <span className="outlet-eyebrow opacity-40">{index}</span>
              <div>
                <h3 className="text-lg font-medium">{title}</h3>
                <p className="mt-2 max-w-md text-sm leading-6 opacity-60">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-8 px-4 py-16 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-24">
        <div>
          <p className="outlet-eyebrow mb-5 opacity-50">A slower kind of new</p>
          <h2 className="outlet-section-title max-w-[9ch]">
            好东西，值得下一个章节。
          </h2>
          <p className="mt-7 max-w-md text-sm leading-7 opacity-65">
            从当季新作到保存良好的 archive 单品，Outlet
            用编辑式目录替代无尽货架。每件商品只保留必要信息，让选择回到材质、用途与设计本身。
          </p>
        </div>
        <div className="relative aspect-[5/4] overflow-hidden">
          <Image
            src="/images/shop-by-styles/Image.jpg"
            alt="Outlet 编辑精选"
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
        </div>
      </section>
    </main>
  )
}
