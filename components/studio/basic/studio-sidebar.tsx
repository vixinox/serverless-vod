"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { ArrowLeft, ChartColumn, LayoutGrid, ListVideo, LogOut, Settings } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { SettingsDialogContent } from "@/components/settings/settings-dialog-content"
import { useSettings } from "@/hooks/use-settings"

const studioItems = [
  {
    title: "内容",
    url: "/studio/contents",
    icon: ListVideo,
  },
  {
    title: "信息中心",
    url: "/studio/dashboard",
    icon: LayoutGrid,
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
  const router = useRouter()
  const session = authClient.useSession().data
  const user = session?.user
  const { flushToDB } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const isDetailPage = /^\/studio\/contents\/.+/.test(pathname)

  const navItems = studioItems

  const isItemActive = (url: string) => {
    if (url === "/") return false
    return pathname === url || pathname.startsWith(`${url}/`)
  }

  return (
    <Dialog
      open={settingsOpen}
      onOpenChange={(open) => {
        setSettingsOpen(open)
        if (!open) flushToDB()
      }}
    >
      <Sidebar collapsible="icon" className="border-r border-sidebar-border/70">
        <SidebarHeader>
          <SidebarMenu>
            {isDetailPage && (
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => router.back()} tooltip="返回">
                  <ArrowLeft strokeWidth={1.75} />
                  <span>返回</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" tooltip={user?.name ?? "我的频道"}>
                <Link href="#">
                  <Avatar className="h-8 w-8 rounded-lg border border-sidebar-border/80">
                    <AvatarImage src={user?.image ?? ""} alt={user?.name ?? ""} />
                    <AvatarFallback className="rounded-lg bg-[#33691e] text-sidebar-primary-foreground">
                      {user?.name ? user.name[0] : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">我的频道</span>
                    <span className="truncate text-xs text-muted-foreground">{user?.name ?? "user"}</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Studio</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isItemActive(item.url)} tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon strokeWidth={1.5} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DialogTrigger asChild>
                <SidebarMenuButton tooltip="设置">
                  <Settings strokeWidth={1.5} />
                  <span>设置</span>
                </SidebarMenuButton>
              </DialogTrigger>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SettingsDialogContent />
    </Dialog>
  )
}