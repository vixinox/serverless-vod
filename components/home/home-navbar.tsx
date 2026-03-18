"use client"

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { AuthButton } from "@/components/auth-button";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePageTransition } from "@/components/transition/transition-context";

export const HomeNavbar = () => {
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startFadeTransition } = usePageTransition();

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const handleBrandClick = () => {
    if (pathname !== '/') startFadeTransition('/', { maskMode: 'keep-home-navbar' });
  };

  const submitSearch = () => {
    const nextQuery = query.trim();

    if (!nextQuery) {
      router.push('/');
      return;
    }

    router.push(`/search?q=${encodeURIComponent(nextQuery)}`);
  };

  return (
    <nav
      data-transition-keep-visible="home-navbar"
      className={`flex h-14 justify-between top-0 px-4 w-full sticky z-10001 transition-all duration-150 bg-background`}
    >
        <button
          onClick={handleBrandClick}
          className="flex items-center font-bold text-base tracking-tight px-2 cursor-pointer select-none"
          aria-label="返回首页"
        >
          VOD
        </button>
      <div className='w-130 shrink-0 relative flex items-center mt-2 mb-2'>
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
          <Search className="size-5!"/>
        </Button>
      </div>
      <div className="flex items-center mr-8">
        <AuthButton/>
      </div>
    </nav>
  )
}
