import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listCategories } from "@/lib/data/categories"
import { ArrowRightIcon } from "@/icons"

export const HomeCategories = async ({ heading }: { heading: string }) => {
  const { parentCategories } = await listCategories()
  const categories = parentCategories.slice(0, 8)

  return (
    <section className="w-full">
      <div className="mb-8 flex items-end justify-between border-b pb-5 outlet-rule">
        <div>
          <p className="outlet-eyebrow mb-3 opacity-50">Browse the archive</p>
          <h2 className="outlet-section-title">{heading}</h2>
        </div>
        <p className="hidden text-xs opacity-45 sm:block">
          {String(categories.length).padStart(2, "0")} 个分类
        </p>
      </div>

      {categories.length ? (
        <div className="border-t outlet-rule">
          {categories.map((category, index) => (
            <LocalizedClientLink
              key={category.id}
              href={`/categories/${category.handle}`}
              className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 border-b py-6 transition-colors hover:bg-[color-mix(in_srgb,var(--outlet-ink)_5%,transparent)] outlet-rule md:py-8"
            >
              <span className="outlet-eyebrow opacity-35">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-2xl font-medium tracking-[-0.035em] transition-transform duration-300 group-hover:translate-x-2 md:text-4xl">
                {category.name}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors group-hover:bg-[var(--outlet-ink)] group-hover:text-[var(--outlet-paper)] outlet-rule">
                <ArrowRightIcon size={17} />
              </span>
            </LocalizedClientLink>
          ))}
        </div>
      ) : (
        <p className="border-y py-10 text-sm opacity-55 outlet-rule">
          当前店铺正在整理商品分类。
        </p>
      )}
    </section>
  )
}
