import { HttpTypes } from "@medusajs/types"
import { CategoryNavbar, NavbarSearch } from "@/components/molecules"

export const Navbar = ({
  categories,
  parentCategories,
}: {
  categories: HttpTypes.StoreProductCategory[]
  parentCategories: HttpTypes.StoreProductCategory[]
}) => {
  return (
    <div
      className="flex flex-col justify-between gap-4 border-b px-4 py-3 md:px-8 lg:flex-row lg:items-center"
      data-testid="navbar"
      style={{ borderColor: "color-mix(in srgb, var(--outlet-ink) 18%, transparent)" }}
    >
      <div className="hidden w-full items-center justify-between lg:flex">
        <CategoryNavbar
          categories={categories}
          parentCategories={parentCategories}
        />
        <div className="ml-auto w-full max-w-[280px] pl-6" data-testid="navbar-search-desktop">
          <NavbarSearch />
        </div>
      </div>
      <div className="w-full lg:hidden" data-testid="navbar-search-mobile">
        <NavbarSearch className="max-w-none" />
      </div>
    </div>
  )
}
