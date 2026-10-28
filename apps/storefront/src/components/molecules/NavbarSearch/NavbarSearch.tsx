"use client"

import { Input } from "@/components/atoms"
import { SearchIcon } from "@/icons"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import clsx from "clsx"

interface Props {
  className?: string
}

export const NavbarSearch = ({ className }: Props) => {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const [search, setSearch] = useState(searchParams.get("query") || "")

  const handleSearch = () => {
    const firstSegment = pathname.split("/")[1]
    const prefix =
      firstSegment === "north" || firstSegment === "field"
        ? `/${firstSegment}`
        : ""
    const query = search.trim()
    router.push(`${prefix}/categories${query ? `?query=${encodeURIComponent(query)}` : ""}`)
  }

  const submitHandler = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleSearch()
  }

  return (
    <form className={clsx("w-full", className)} method="POST" onSubmit={submitHandler}>
      <Input
        icon={<SearchIcon />}
        onIconClick={handleSearch}
        iconAriaLabel="Search"
        placeholder="搜索单品、品牌或风格"
        value={search}
        changeValue={setSearch}
        type="search"
      />
      <input type="submit" className="hidden" />
    </form>
  )
}
