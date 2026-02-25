export type AuthAction = "login" | "signup" | "social-login" | "signout"

type AuthLikeError = {
  code?: string
  message?: string
  statusText?: string
}

const fallbackMessageByAction: Record<AuthAction, string> = {
  login: "登录失败，请稍后重试。",
  signup: "注册失败，请稍后重试。",
  "social-login": "第三方登录失败，请稍后重试。",
  signout: "退出失败，请稍后重试。",
}

const mappedMessageByCode: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "邮箱或密码错误",
  INVALID_CREDENTIALS: "邮箱或密码错误",
  USER_ALREADY_EXISTS: "该邮箱已被注册",
  EMAIL_ALREADY_EXISTS: "该邮箱已被注册",
  OAUTH_ACCOUNT_NOT_LINKED: "该邮箱已被其他登录方式占用",
}

const mappedMessageByText: Array<[keyword: string, mapped: string]> = [
  ["invalid password", "邮箱或密码错误"],
  ["invalid credentials", "邮箱或密码错误"],
  ["already exists", "该邮箱已被注册"],
  ["network", "网络异常，请检查连接后重试"],
  ["fetch", "网络异常，请检查连接后重试"],
]

export function getAuthErrorMessage(action: AuthAction, error: unknown) {
  if (!error) {
    return fallbackMessageByAction[action]
  }

  const authError = error as AuthLikeError

  if (authError.code && mappedMessageByCode[authError.code]) {
    return mappedMessageByCode[authError.code]
  }

  const message = (authError.message ?? authError.statusText ?? "").trim()
  if (message) {
    const lowerMessage = message.toLowerCase()
    const matched = mappedMessageByText.find(([keyword]) =>
      lowerMessage.includes(keyword)
    )

    if (matched) {
      return matched[1]
    }

    return message
  }

  return fallbackMessageByAction[action]
}
