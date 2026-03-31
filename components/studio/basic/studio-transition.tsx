"use client"

import {
  createContext,
  startTransition as reactStartTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { PageReadySignal } from "@/components/transition/page-ready-signal"
import { cn } from "@/lib/utils"

type StudioTransitionStage = "idle" | "exiting" | "entering"
type NavigationGuard = () => boolean | Promise<boolean>

type StudioTransitionContextValue = {
  pendingHref: string | null
  stage: StudioTransitionStage
  navigate: (href: string) => void
  goBack: (fallbackHref?: string) => void
  setNavigationGuard: (guard: NavigationGuard | null) => void
}

const StudioTransitionContext = createContext<StudioTransitionContextValue | null>(null)

const EXIT_DURATION_MS = 180
const ENTER_DURATION_MS = 520

function prefersReducedMotion() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function StudioTransitionProvider({ children }: PropsWithChildren) {
  const router = useRouter()
  const pathname = usePathname()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [stage, setStage] = useState<StudioTransitionStage>("idle")
  const previousPathRef = useRef(pathname)
  const hasMountedRef = useRef(false)
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigationGuardRef = useRef<NavigationGuard | null>(null)

  const clearTimers = useCallback(() => {
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current)
      exitTimeoutRef.current = null
    }

    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current)
      enterTimeoutRef.current = null
    }
  }, [])

  const confirmNavigation = useCallback(async () => {
    const navigationGuard = navigationGuardRef.current
    if (!navigationGuard) return true

    try {
      return await navigationGuard()
    } catch {
      return false
    }
  }, [])

  const navigate = useCallback(
    async (href: string) => {
      if (!href || href === pathname || pendingHref) return

      const canProceed = await confirmNavigation()
      if (!canProceed) return

      clearTimers()

      if (prefersReducedMotion()) {
        setPendingHref(null)
        setStage("idle")
        router.push(href)
        return
      }

      setPendingHref(href)
      setStage("exiting")

      exitTimeoutRef.current = setTimeout(() => {
        reactStartTransition(() => {
          router.push(href)
        })
      }, EXIT_DURATION_MS)
    },
    [clearTimers, confirmNavigation, pathname, pendingHref, router]
  )

  const goBack = useCallback(
    async (fallbackHref = "/studio/contents") => {
      if (pendingHref) return

      const canProceed = await confirmNavigation()
      if (!canProceed) return

      if (typeof window !== "undefined" && window.history.length <= 1) {
        void navigate(fallbackHref)
        return
      }

      router.back()
    },
    [confirmNavigation, navigate, pendingHref, router]
  )

  const setNavigationGuard = useCallback((guard: NavigationGuard | null) => {
    navigationGuardRef.current = guard
  }, [])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      previousPathRef.current = pathname
      return
    }

    if (pathname === previousPathRef.current) return

    previousPathRef.current = pathname
    clearTimers()
    setPendingHref(null)

    if (prefersReducedMotion()) {
      setStage("idle")
      return
    }

    setStage("entering")
    enterTimeoutRef.current = setTimeout(() => {
      setStage("idle")
    }, ENTER_DURATION_MS)
  }, [clearTimers, pathname])

  const value = useMemo(
    () => ({
      pendingHref,
      stage,
      navigate,
      goBack,
      setNavigationGuard,
    }),
    [goBack, navigate, pendingHref, setNavigationGuard, stage]
  )

  return (
    <StudioTransitionContext.Provider value={value}>
      {children}
    </StudioTransitionContext.Provider>
  )
}

export function useStudioTransition() {
  const context = useContext(StudioTransitionContext)

  if (!context) {
    throw new Error("useStudioTransition must be used within StudioTransitionProvider.")
  }

  return context
}

export function StudioTransitionSurface({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  const pathname = usePathname()
  const { stage } = useStudioTransition()

  return (
    <div className="relative flex-1 overflow-hidden">
      <PageReadySignal key={pathname} />
      <div
        data-stage={stage}
        className={cn(
          "relative flex h-full flex-col",
          stage === "entering" &&
            "[animation:studio-page-enter_520ms_cubic-bezier(0.16,1,0.3,1)_both]",
          stage === "exiting" &&
            "[animation:studio-page-exit_180ms_cubic-bezier(0.7,0,0.84,0)_both]",
          className
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sidebar-primary/45 to-transparent opacity-0",
            stage === "entering" &&
              "[animation:studio-page-beam_720ms_cubic-bezier(0.16,1,0.3,1)_both]"
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sidebar-primary/8 via-sidebar-primary/3 to-transparent opacity-0 transition-opacity duration-500",
            stage === "entering" && "opacity-100"
          )}
        />
        {children}
      </div>
    </div>
  )
}
