"use client"

import type { MouseEvent } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { ArrowLeft, ChartColumn, ListVideo, LogOut } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePathname } from "next/navigation"
import { Fragment } from "react"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { useStudioTransition } from "@/components/studio/basic/studio-transition"

const studioItems = [
  {
    title: "内容",
    url: "/studio/contents",
    icon: ListVideo,
  },
  {
    title: "数据分析",
    url: "/studio/stat",
    icon: ChartColumn,
  },
  {
    title: "退出工作室",
    url: "/",
    icon: LogOut,
  },
]

export const StudioSidebar = () => {
  const pathname = usePathname()
  const { navigate, goBack, pendingHref } = useStudioTransition()
  const session = authClient.useSession().data
  const user = session?.user
  const isInContentPath = pathname.startsWith("/studio/contents")
  const isInStudio = pathname.startsWith("/studio")
  const shouldShowBackButton = isInStudio && !isInContentPath
  const navItems = studioItems

  const isItemActive = (url: string) => {
    if (url === "/") return false
    return pathname === url || pathname.startsWith(`${url}/`)
  }

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const target = event.currentTarget.target
    if (target && target !== "_self") return

    event.preventDefault()
    void navigate(href)
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/70">
      <SidebarHeader>
        <SidebarMenu>
          {!shouldShowBackButton && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip={user?.name ?? "我的频道"}
                className="rounded-2xl border border-transparent transition duration-300 hover:-translate-y-px hover:border-sidebar-border/70 hover:shadow-sm"
              >
                <Link href="#" className="min-w-0">
                  <Avatar className="h-8 w-8 rounded-full border border-sidebar-border/80">
                    <AvatarImage src={user?.image ?? ""} alt={user?.name ?? ""} />
                    <AvatarFallback className="bg-[#33691e] text-sidebar-primary-foreground">
                      {user?.name ? user.name[0] : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 overflow-hidden text-left text-sm leading-tight">
                    <span className="truncate font-medium">我的频道</span>
                    <span className="truncate text-xs text-muted-foreground">{user?.name ?? "user"}</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {shouldShowBackButton && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => void goBack("/studio/contents")}
                tooltip="返回"
                className="min-w-0 rounded-2xl border border-transparent transition duration-300 hover:-translate-y-px hover:border-sidebar-border/70 hover:shadow-sm"
              >
                <ArrowLeft strokeWidth={1.75} />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">返回</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden">
        <SidebarSeparator className="my-1 mx-0" />
        {navItems.map((item, index) => (
          <Fragment key={item.title}>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isItemActive(item.url)}
                      tooltip={item.title}
                      data-pending={pendingHref === item.url ? "true" : undefined}
                      className={cn(
                        "h-full min-w-0 rounded-xl border border-transparent px-3 transition duration-300",
                        "hover:-translate-y-px hover:border-sidebar-border/70",
                        "data-[active=true]:border-sidebar-border/70 data-[active=true]:shadow-sm",
                        "data-[pending=true]:scale-[0.985] data-[pending=true]:border-sidebar-border/80"
                      )}
                    >
                      <Link href={item.url} onClick={(event) => handleNavigation(event, item.url)} className="min-w-0">
                        <item.icon strokeWidth={1.5} />
                        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {item.title}
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "ml-auto flex size-1.5 shrink-0 rounded-full bg-sidebar-primary overflow-hidden transition duration-300 group-data-[collapsible=icon]:hidden",
                            isItemActive(item.url) ? "scale-100 opacity-100" : "scale-50 opacity-0",
                            pendingHref === item.url && "animate-pulse"
                          )}
                        />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {index < navItems.length - 1 && <SidebarSeparator />}
          </Fragment>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
