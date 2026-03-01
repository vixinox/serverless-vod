"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Dialog, DialogContent, DialogTrigger, } from "@/components/ui/dialog"
import { ArrowLeft, ChartColumn, LayoutGrid, ListVideo, LogOut, Settings } from "lucide-react"
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";

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
  const pathname = usePathname();
  const { state, isMobile, toggleSidebar } = useSidebar()
  const prevWidthRef = useRef(0);
  const router = useRouter();
  const session = authClient.useSession().data;
  const user = session?.user;

  useEffect(() => {
    if (isMobile) return;

    function handleResize() {
      const prevWidth = prevWidthRef.current;
      const currentWidth = window.innerWidth;
      if (
        prevWidth < 1200 &&
        currentWidth >= 1200 &&
        state === 'collapsed'
      ) toggleSidebar();

      if (
        prevWidth >= 1200 &&
        currentWidth < 1200 &&
        state === 'expanded'
      ) toggleSidebar();

      prevWidthRef.current = currentWidth;
    }

    window.addEventListener('resize', handleResize);
    prevWidthRef.current = window.innerWidth;
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [state, isMobile, toggleSidebar]);

  return (
    <Sidebar collapsible="icon" className="ease-out">
      <SidebarContent className="mt-15 px-1 gap-0 bg-studio-background">
        <SidebarHeader className="flex items-center justify-center gap-0">
          {/^\/studio\/contents\/.+/.test(pathname) &&
           <SidebarMenuButton
             className="h-12 mt-4 hover:bg-hover-dark cursor-pointer flex
               group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:h-full!"
             onClick={() => router.back()}
           >
             <div className="flex h-full items-center justify-center aspect-square">
               <ArrowLeft/>
             </div>
             <span className={cn(
               "text-base font-medium ml-3 whitespace-nowrap transition-all ",
               state === "expanded" ? "opacity-100" : "opacity-0 block")}>
                返回
                </span>
           </SidebarMenuButton>
          }
          <Link href="#" className="mt-5 transition-all flex items-center rounded-full justify-center">
            <Avatar className={cn(
              "size-full hover:opacity-20 border-2 transition-all",
              state === "expanded" || isMobile ? "size-28" : "size-10"
            )}>
              <AvatarImage src={user?.image ?? ""} alt={user?.name ?? ""}/>
              <AvatarFallback
                className={cn("transition-all bg-[#33691e]", state === "expanded" || isMobile ? "text-6xl" : "text-xl")}>
                {user?.name ? user.name[0] : ""}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div
            className={cn(
              "transition-all overflow-hidden flex flex-col items-center",
              state === "expanded"
                ? "opacity-100 max-h-24"
                : "opacity-0 max-h-0"
            )}
          >
            <p className="text-sm font-medium whitespace-nowrap mt-2">我的频道</p>
            <p className="text-xs text-muted-foreground mt-1">{user?.name ?? "user"}</p>
          </div>
        </SidebarHeader>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {studioItems.map((item) => (
                <Link href={item.url} key={item.title}>
                  <SidebarMenuItem className="h-12">
                    <SidebarMenuButton
                      tooltip={item.title}
                      className={cn(
                        "h-full hover:bg-hover-dark " +
                        "group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:h-full!",
                        pathname === item.url ? "bg-hover-dark" : "",
                      )}
                    >
                      <div className="flex h-full items-center justify-center aspect-square">
                        <item.icon strokeWidth={1.25} size={24}/>
                      </div>
                      <span className={cn(
                        "text-base font-medium ml-3 whitespace-nowrap transition-all ",
                        state === "expanded" ? "opacity-100" : "opacity-0 block"
                      )}>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </Link>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-studio-background">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <Dialog>
                <form>
                  <SidebarMenuItem className="h-12">
                    <DialogTrigger asChild>
                      <SidebarMenuButton
                        tooltip="设置"
                        className={cn(
                          "h-full hover:bg-primary/15 " +
                          "group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:h-full!",
                        )}
                      >
                        <div className="flex h-full items-center justify-center">
                          <Settings strokeWidth={1.25} size={24}/>
                        </div>
                        <span className={cn(
                          "text-base font-medium ml-3 whitespace-nowrap transition-all ",
                          state === "expanded" ? "opacity-100" : "opacity-0 block"
                        )}>设置</span>
                      </SidebarMenuButton>
                    </DialogTrigger>
                  </SidebarMenuItem>
                  <DialogContent className="sm:max-w-106">

                  </DialogContent>
                </form>
              </Dialog>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarFooter>
    </Sidebar>
  );
};