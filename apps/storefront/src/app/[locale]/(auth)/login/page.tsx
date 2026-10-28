import { LoginForm } from "@/components/molecules"
import { retrieveCustomer } from "@/lib/data/customer"
import { tenantInternalPath } from "@/lib/helpers/safe-redirect"
import { getTenant } from "@/lib/tenant"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Login",
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const user = await retrieveCustomer()
  const { redirect: redirectParam } = await searchParams

  if (user) {
    const tenant = await getTenant()
    redirect(tenantInternalPath(tenant.slug, redirectParam))
  }

  return <LoginForm />
}

