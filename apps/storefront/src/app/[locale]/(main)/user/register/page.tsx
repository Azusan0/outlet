import { RegisterForm } from "@/components/molecules"
import { retrieveCustomer } from "@/lib/data/customer"
import { getTenant } from "@/lib/tenant"
import { redirect } from "next/navigation"

export default async function Page() {
  const user = await retrieveCustomer()

  if (user) {
    const tenant = await getTenant()
    redirect(`/${tenant.slug}/user`)
  }

  return <RegisterForm />
}
