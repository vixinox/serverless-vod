import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { SignupForm } from "@/components/signup-form"
import { auth } from "@/lib/auth"

export default async function SignupPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    redirect("/")
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <SignupForm />
      </div>
    </div>
  )
}
