import { HttpTypes } from "@medusajs/types"

export interface Cart extends HttpTypes.StoreCart {
  discount_subtotal?: number
}

export interface StoreCartLineItemOptimisticUpdate
  extends Partial<HttpTypes.StoreCartLineItem> {
  tax_total: number
}
