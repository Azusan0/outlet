"use client"

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react"
import { Fragment, useMemo } from "react"
import ReactCountryFlag from "react-country-flag"

import { useParams, usePathname, useRouter } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import { updateRegionWithValidation } from "@/lib/data/cart"
import { Label } from "@medusajs/ui"
import { toast } from "@/lib/helpers/toast"

type CountryOption = {
  country: string
  region: string
  label: string
}

type CountrySelectProps = {
  regions: HttpTypes.StoreRegion[]
}

const CountrySelect = ({ regions }: CountrySelectProps) => {
  const { locale: countryCode } = useParams()
  const router = useRouter()
  const currentPath = usePathname().split(`/${countryCode}`)[1]

  const options = useMemo<CountryOption[]>(
    () =>
      regions
        .flatMap((region) =>
          (region.countries ?? []).flatMap((country) =>
            country.iso_2
              ? [
                  {
                    country: country.iso_2,
                    region: region.id,
                    label: country.display_name || country.iso_2,
                  },
                ]
              : []
          )
        )
        .sort((a, b) => a.label.localeCompare(b.label)),
    [regions]
  )

  const current =
    typeof countryCode === "string"
      ? options.find((option) => option.country === countryCode)
      : undefined

  const handleChange = async (option: CountryOption) => {
    try {
      const result = await updateRegionWithValidation(option.country, currentPath)
      
      if (result.removedItems.length > 0) {
        const itemsList = result.removedItems.join(", ")
        toast.info({
          title: "Cart updated",
          description: `${itemsList} ${result.removedItems.length === 1 ? "is" : "are"} not available in ${option.label} and ${result.removedItems.length === 1 ? "was" : "were"} removed from your cart.`,
        })
      }

      router.push(result.newPath)
      router.refresh()
    } catch (error: any) {
      toast.error({
        title: "Error switching region",
        description: error?.message || "Failed to update region. Please try again.",
      })
    }
  }

  return (
    <div className="md:flex gap-2 items-center justify-end relative">
      <Label className="label-md hidden md:block">配送至</Label>
      <div>
        <Listbox
          onChange={handleChange}
          defaultValue={current}
        >
          <ListboxButton className="relative w-16 flex justify-between items-center h-10 bg-component-secondary text-left  cursor-default focus:outline-none border rounded-lg focus-visible:ring-2 focus-visible:ring-opacity-75 focus-visible:ring-white focus-visible:ring-offset-gray-300 focus-visible:ring-offset-2 focus-visible:border-gray-300 text-base-regular">
            <div className="txt-compact-small flex items-start mx-auto">
              {current && (
                <span className="txt-compact-small flex items-center gap-x-2">
                  {/* @ts-ignore */}
                  <ReactCountryFlag
                    alt={`${current.country?.toUpperCase()} flag`}
                    svg
                    style={{
                      width: "16px",
                      height: "16px",
                    }}
                    countryCode={current.country ?? ""}
                  />
                  {current.country?.toUpperCase()}
                </span>
              )}
            </div>
          </ListboxButton>
          <div className="flex relative w-16">
            <Transition
              as={Fragment}
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <ListboxOptions className="no-scrollbar absolute z-20 overflow-auto text-small-regular bg-white border rounded-lg border-top-0 max-h-60 focus:outline-none sm:text-sm">
                {options?.map((o, index) => {
                  return (
                    <ListboxOption
                      key={index}
                      value={o}
                      className="cursor-pointer select-none relative w-16 hover:bg-gray-50 py-2 border-b"
                    >
                      <span className="flex items-center gap-x-2 pl-2">
                        {/* @ts-ignore */}
                        <ReactCountryFlag
                          svg
                          style={{
                            width: "16px",
                            height: "16px",
                          }}
                          countryCode={o?.country ?? ""}
                        />{" "}
                        {o?.country?.toUpperCase()}
                      </span>
                    </ListboxOption>
                  )
                })}
              </ListboxOptions>
            </Transition>
          </div>
        </Listbox>
      </div>
    </div>
  )
}

export default CountrySelect
