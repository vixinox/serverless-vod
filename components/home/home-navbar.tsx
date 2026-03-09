"use client"

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { AuthButton } from "@/components/auth-button";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { usePageTransition } from "@/components/transition/transition-context";

export const HomeNavbar = () => {
  const [isAtTop, setisAtTop] = useState(true)
  const pathname = usePathname();
  const { startFadeTransition } = usePageTransition();

  const handleBrandClick = () => {
    if (pathname !== '/') startFadeTransition('/', { maskMode: 'keep-home-navbar' });
  };

  useEffect(() => {
    const handleScroll = () => {
      setisAtTop(window.scrollY === 0)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
      <div className='w-160 shrink-0 flex items-center'>
        <Input
          type='text'
          className='rounded-l-full h-10 focus:border-blue-500'
          placeholder=' 搜索'
        />
        <Button
          className='rounded-r-full w-14 h-10 border bg-foreground/20 cursor-pointer'
          variant={'ghost'}
          type='submit'
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