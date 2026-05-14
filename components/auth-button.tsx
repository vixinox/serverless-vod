"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

export function AuthButton() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const [avatarImageLoaded, setAvatarImageLoaded] = useState(false);
  const lastAvatarImageRef = useRef<string | null>(null);

  useEffect(() => {
    const nextImage = user?.image ?? null;

    // Route switches may temporarily clear session data. Only reset when URL truly changes.
    if (nextImage && nextImage !== lastAvatarImageRef.current) {
      setAvatarImageLoaded(false);
    }

    lastAvatarImageRef.current = nextImage;
  }, [user?.image]);

  if (!user && isPending) {
    return (
      <Avatar className="h-10 w-10">
        <AvatarFallback className="bg-[#33691e] text-lg text-white">U</AvatarFallback>
      </Avatar>
    );
  }

  if (!user) {
    return (
      <Link href="/login" className="rounded-full">
        <Button
          className="px-4 py-2 text-sm font-medium rounded-full border bg-transparent hover:bg-primary/15 hover:border-transparent
            text-blue-600 hover:text-blue-700 border-blue-500 shadow-none cursor-pointer"
        >
          <UserRound />
          登录
        </Button>
      </Link>
    );
  }

  return (
    <>
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user?.image ?? ""}
              alt={user?.name ?? ""}
              onLoadingStatusChange={(status) => {
                setAvatarImageLoaded(status === "loaded");
              }}
              className={`transition duration-300 ${
                user?.image && avatarImageLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
            <AvatarFallback className="bg-[#33691e] text-lg text-white">{user?.name?.charAt(0) ?? "U"}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-76 p-0 z-10002" align="end">

        <div className="flex p-4 gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.image ?? ""} alt={user.name ?? ""} />
            <AvatarFallback className="bg-[#33691e] text-lg text-white">{user.name?.charAt(0) ?? "U"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col truncate">
            <span className="font-medium truncate">{user.name}</span>
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            {/* <a href="#" className="mt-2 text-blue-500 text-sm truncate max-w-fit">查看你的频道</a> */}
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="rounded-none cursor-pointer mt-1 h-11">
          <Link href="/studio" className="flex items-center gap-3">
            <User className="text-foreground size-5.5 ml-2" strokeWidth="2" />
            <span className="text-sm ml-2">工作室</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="rounded-none cursor-pointer h-11"
          onClick={async () => {
            const { error } = await authClient.signOut();
            if (error) {
              toast.error(error.message || "退出失败，请重试");
              return;
            }
            router.push("/login");
            router.refresh();
          }}
        >
          <div className="flex items-center gap-3">
            <LogOut className="text-foreground size-5.5 ml-2" strokeWidth="2" />
            <span className="text-sm ml-2">退出登录</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}