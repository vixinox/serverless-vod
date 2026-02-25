"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { getAuthErrorMessage } from "@/lib/auth-error"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loadingCredential, setLoadingCredential] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<"github" | "google" | null>(null)

  const onEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoadingCredential(true)

    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/?toast=login-success",
    })

    if (error) {
      toast.error(getAuthErrorMessage("login", error))
      setLoadingCredential(false)
      return
    }

    setLoadingCredential(false)
    router.push("/?toast=login-success")
  }

  const onSocialLogin = async (provider: "github" | "google") => {
    setLoadingProvider(provider)

    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: "/?toast=login-success",
    })

    if (error) {
      toast.error(getAuthErrorMessage("social-login", error))
      setLoadingProvider(null)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">欢迎回来</CardTitle>
          <CardDescription>
            使用邮箱、GitHub 或 Google 登录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onEmailLogin}>
            <FieldGroup>
              <Field>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onSocialLogin("github")}
                  disabled={loadingCredential || loadingProvider !== null}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="mr-2 size-4"
                    fill="currentColor"
                  >
                    <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 5.02 3.25 9.27 7.76 10.77.57.1.78-.25.78-.56 0-.28-.01-1.02-.02-2-3.15.69-3.81-1.52-3.81-1.52-.52-1.3-1.26-1.64-1.26-1.64-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.24 3.31.95.1-.73.4-1.24.72-1.52-2.51-.29-5.15-1.25-5.15-5.58 0-1.23.44-2.23 1.17-3.02-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.14 1.15a10.9 10.9 0 0 1 5.72 0c2.18-1.46 3.14-1.15 3.14-1.15.62 1.59.23 2.77.11 3.06.73.79 1.17 1.79 1.17 3.02 0 4.34-2.64 5.29-5.16 5.57.41.35.77 1.03.77 2.08 0 1.5-.01 2.7-.01 3.06 0 .31.2.67.79.56A11.26 11.26 0 0 0 23.25 11.75C23.25 5.48 18.27.5 12 .5Z" />
                  </svg>
                  {loadingProvider === "github" ? "跳转中..." : "使用 GitHub 登录"}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onSocialLogin("google")}
                  disabled={loadingCredential || loadingProvider !== null}
                >
                  <svg aria-hidden="true" viewBox="0 0 48 48" className="mr-2 size-4">
                    <path
                      fill="#FFC107"
                      d="M43.611 20.083H42V20H24v8h11.303C33.655 32.657 29.207 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.28 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.28 4 24 4c-7.682 0-14.35 4.337-17.694 10.691z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.178 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.161 35.091 26.715 36 24 36c-5.186 0-9.627-3.329-11.291-7.949l-6.522 5.025C9.5 39.556 16.227 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.611 20.083H42V20H24v8h11.303a12.05 12.05 0 0 1-4.084 5.57l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                    />
                  </svg>
                  {loadingProvider === "google" ? "跳转中..." : "使用 Google 登录"}
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                或使用邮箱登录
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email">邮箱</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="请输入邮箱"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">密码</FieldLabel>
                  <Link
                    href="#"
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                  >
                    忘记密码？
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </Field>
              <Field>
                <Button type="submit" disabled={loadingCredential || loadingProvider !== null}>
                  {loadingCredential ? "登录中..." : "邮箱登录"}
                </Button>
                <FieldDescription className="text-center">
                  还没有账号？<Link href="/signup">去注册</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        点击继续即表示你同意我们的服务条款与隐私政策。
      </FieldDescription>
    </div>
  )
}
