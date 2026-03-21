"use client"

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { AuthButton } from "@/components/auth-button";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { usePageTransition } from "@/components/transition/transition-context";

export const HomeNavbar = () => {
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startFadeTransition } = usePageTransition();

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const getPreferredMaskMode = () => {
    if (typeof document === "undefined") {
      return "keep-home-navbar" as const;
    }

    const hasRail = Boolean(
      document.querySelector('[data-transition-keep-visible="home-rail"]')
    );

    return hasRail ? "keep-home-rail" : "keep-home-navbar";
  };

  const handleBrandClick = () => {
    if (pathname !== '/') {
      startFadeTransition('/', { maskMode: getPreferredMaskMode() });
    }
  };

  const submitSearch = () => {
    const nextQuery = query.trim();

    if (!nextQuery) {
      startFadeTransition('/', { maskMode: getPreferredMaskMode() });
      return;
    }

    startFadeTransition(`/search?q=${encodeURIComponent(nextQuery)}`, {
      maskMode: getPreferredMaskMode(),
    });
  };

  return (
    <nav
      data-transition-keep-visible="home-navbar"
      className="sticky top-0 z-10001 grid w-full grid-cols-[minmax(0,1fr)_minmax(0,34rem)_minmax(0,1fr)] items-center gap-3 bg-background px-4 py-1 transition-all duration-150"
    >
      <button
        onClick={handleBrandClick}
        className="flex justify-self-start cursor-pointer items-center px-2 text-xl font-bold tracking-tight select-none"
        aria-label="返回首页"
      >
        VOD
      </button>
      <div className="relative my-2 w-full items-center">
        <Input
          type='text'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitSearch();
            }
          }}
          className='w-full h-11 rounded-full pr-14 bg-muted/70 border-2 border-border/60 hover:bg-muted hover:border-border transition-[background-color,border-color,box-shadow] duration-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-[0_0_0_3px_hsl(var(--border)/0.45)]'
          placeholder=' 搜索'
        />
        <Button
          className='absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full cursor-pointer'
          variant={'ghost'}
          type='submit'
          onClick={submitSearch}
        >
          <Search className="size-5!" />
        </Button>
      </div>
      <div className="flex justify-self-end shrink-0 items-center gap-2 pr-2 md:pr-6">
        <AuthButton />
      </div>
    </nav>
  )
}
