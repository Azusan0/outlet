import type { Metadata } from "next"

import { PortalDemo } from "./portal-demo"

export const metadata: Metadata = {
  title: "Outlet Workspace",
  description: "Outlet 多品牌商业中台工作区演示",
}

export default function PortalPage() {
  return <PortalDemo />
}
