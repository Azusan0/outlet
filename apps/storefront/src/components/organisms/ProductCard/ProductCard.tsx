"use client"

import Image from "next/image"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { getProductPrice } from "@/lib/helpers/get-product-price"
import { cn } from "@/lib/utils"
import { Product } from "@/types/product"
import { ArrowRightIcon } from "@/icons"

export const ProductCard = ({
  product,
  className,
}: {
  product: HttpTypes.StoreProduct | Product
  className?: string
}) => {
  if (!product) return null

  const { cheapestPrice } = getProductPrice({
    product: product as HttpTypes.StoreProduct,
  })
  const productName = String(product.title || "未命名商品")
  const hasDiscount =
    cheapestPrice?.calculated_price &&
    cheapestPrice.calculated_price !== cheapestPrice.original_price

  return (
    <article
      className={cn(
        "group flex min-w-[250px] flex-col lg:w-[calc(25%-1rem)]",
        className
      )}
      data-testid="product-card"
      data-product-handle={product.handle}
    >
      <LocalizedClientLink
        href={`/products/${product.handle}`}
        aria-label={`查看 ${productName}`}
        title={`查看 ${productName}`}
        className="block"
        data-testid="product-card-link"
      >
        <div
          className="relative aspect-[4/5] overflow-hidden"
          style={{ background: "color-mix(in srgb, var(--outlet-ink) 7%, transparent)" }}
          data-testid="product-card-image-container"
        >
          {product.thumbnail ? (
            <Image
              src={decodeURIComponent(product.thumbnail)}
              alt={`${productName} 商品图`}
              width={900}
              height={1125}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
              data-testid="product-card-image"
            />
          ) : (
            <Image
              src="/images/placeholder.svg"
              alt={`${productName} 占位图`}
              width={900}
              height={1125}
              className="h-full w-full object-cover"
              data-testid="product-card-placeholder-image"
            />
          )}
          <span className="absolute left-3 top-3 bg-[var(--outlet-paper)] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
            {hasDiscount ? "往季价格" : "独立卖家"}
          </span>
        </div>
      </LocalizedClientLink>

      <LocalizedClientLink
        href={`/products/${product.handle}`}
        aria-label={`进入 ${productName} 详情页`}
        title={`进入 ${productName} 详情页`}
      >
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b py-4 outlet-rule" data-testid="product-card-info">
          <div className="min-w-0">
            <h3
              className="line-clamp-2 text-[15px] font-medium leading-5 tracking-[-0.015em]"
              data-testid="product-card-title"
            >
              {productName}
            </h3>
            <div className="mt-2 flex items-center gap-2" data-testid="product-card-price">
              <p className="text-sm font-semibold" data-testid="product-card-current-price">
                {cheapestPrice?.calculated_price || "暂无报价"}
              </p>
              {hasDiscount && (
                <p className="text-xs line-through opacity-45" data-testid="product-card-original-price">
                  {cheapestPrice.original_price}
                </p>
              )}
            </div>
          </div>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors group-hover:bg-[var(--outlet-ink)] group-hover:text-[var(--outlet-paper)] outlet-rule"
            aria-hidden="true"
          >
            <ArrowRightIcon size={15} />
          </span>
        </div>
      </LocalizedClientLink>
    </article>
  )
}
