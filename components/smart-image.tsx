"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Image from "next/image"; // 引入 Next.js 核心组件
import { Spinner } from "@/components/ui/spinner";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type NextSmartImageProps = {
  src?: string | null;
  alt: string;
  refreshKey?: number;
  minLoadingMs?: number;
  className?: string; // 控制外部容器
  imageClassName?: string; // 细粒度控制图片本身
  autoRetry?: boolean;
  maxRetries?: number; // 抽离重试上限为常量配置
  priority?: boolean; // 透传 Next.js 关键属性，LCP 优化
  sizes?: string; // 透传 responsive 大小设置
};

export function SmartImage({
  src,
  alt,
  refreshKey,
  minLoadingMs = 300,
  className = "",
  imageClassName = "",
  autoRetry = false,
  maxRetries = 5,
  priority = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw", // 默认响应式
}: NextSmartImageProps) {
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [attempt, setAttempt] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  // 1. 消除状态机与渲染周期的强耦合缺陷
  // 使用 useRef 记录组件是否卸载，防御内存泄漏 (非常关键！)
  const isMounted = useRef(true);
  // 用 useRef 存下所有的定时器，以便发生变更时快速清除
  const timers = useRef<{ [key: string]: NodeJS.Timeout }>({});
  // 去除 setLoadStartTime state，减轻一次不必要的 React re-render
  // 时间标记不需要导致视图重绘，改用 ref 存储极为完美
  const loadStartTime = useRef<number>(Date.now());

  // 2. 核心 URL 及请求协议诊断解析
  const isValidSrc = !!src && src.trim() !== "";
  const isBlobOrDataUrl = isValidSrc && (src.startsWith("blob:") || src.startsWith("data:"));
  
  // 3. 规避 Next.js Optimization Server DDOS 的核武器级逻辑
  // 只有在基础首次加载时，我们让 Next.js 服务器进行图片压缩优化
  // 只要发生重试 (attempt > 0) 或者存在针对性强制刷新 (refreshKey 存在)，
  // 我们强制判定为【非优化请求】，跳过 Next.js 后台压缩，直接打向源站，保护服务器。
  const shouldUnoptimize = attempt > 0 || !!refreshKey || isBlobOrDataUrl;

  // 构建带缓存破坏的最终源。注意：当交给 Next.js Image 时，_cb 是透明传递的。
  const finalSrc = (() => {
    if (!isValidSrc) return "";
    if (isBlobOrDataUrl) return src;
    
    // 如果没有任何重试或刷新行为，保持纯净 URL 命中 Next.js Server 高效边缘缓存
    if (attempt === 0 && !refreshKey) return src;
    
    // 生成缓存终结者 URL
    const separator = src.includes("?") ? "&" : "?";
    // 采用更可靠的数学计算时间戳+尝试次数
    const cbHash = refreshKey ?? Date.now() + Math.random().toString(36).substring(7);
    return `${src}${separator}_cb=${cbHash}_${attempt}`;
  })();

  // 4. 组件卸载时的终极垃圾回收 (GC) 安全保障
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // 清空所有幽灵定时器
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  // 5. 监听源变动，重置状态机的反应堆
  useEffect(() => {
    if (!isValidSrc) {
      setStatus("error");
      return;
    }
    
    // 清理之前的成功或失败延迟定时器
    Object.values(timers.current).forEach(clearTimeout);
    
    setStatus("loading");
    setAttempt(0);
    loadStartTime.current = Date.now();
  }, [src, refreshKey, isValidSrc]); // 移除不必要的隐式依赖

  // 6. 重构：成功态处理器
  const handleSuccess = useCallback(() => {
    if (!isMounted.current) return;
    
    const elapsed = Date.now() - loadStartTime.current;
    const delay = elapsed >= minLoadingMs ? 0 : minLoadingMs - elapsed;
    
    // 如果没有延迟要求，瞬间点亮，消除 event loop 积压
    if (delay === 0) {
      setStatus("success");
      return;
    }

    timers.current.successCb = setTimeout(() => {
      if (isMounted.current) setStatus("success");
    }, delay);
  }, [minLoadingMs]);

  // 7. 重构：失败阻击与指数退避重试网络
  const handleError = useCallback(() => {
    if (!isMounted.current) return;

    if (autoRetry && attempt < maxRetries && isValidSrc) {
      setStatus("loading");
      // 限制最大退避时间，防止达到极其荒唐的延时级别 (例如封顶最大等待 15秒)
      const baseDelay = 300 * Math.pow(2, attempt);
      const retryDelay = Math.min(baseDelay, 15000); 

      timers.current.retryCb = setTimeout(() => {
        if (isMounted.current) {
          loadStartTime.current = Date.now(); // 重置计时器以提供完美的闪烁保护
          setAttempt(prev => prev + 1);
        }
      }, retryDelay);
    } else {
      setStatus("error");
    }
  }, [autoRetry, attempt, isValidSrc, maxRetries]);

  // Cached images can finish before React delivers onLoad.
  // Detect that case so the component does not stay in the loading state forever.
  useEffect(() => {
    if (!finalSrc || status !== "loading") return;

    const img = imageRef.current;
    if (!img?.complete) return;

    if (img.naturalWidth > 0) {
      handleSuccess();
      return;
    }

    handleError();
  }, [finalSrc, handleError, handleSuccess, status]);


  return (
    <div className={cn("w-full h-full relative group overflow-hidden", className)}>
      
      {finalSrc && (
        <Image
          ref={imageRef}
          src={finalSrc}
          alt={alt}
          fill
          unoptimized={shouldUnoptimize}
          priority={priority}
          sizes={sizes}
          onLoad={handleSuccess}
          onError={handleError}
          className={cn(
            "object-cover transition duration-500 ease-in-out",
            status === "success" ? "opacity-100" : "opacity-0",
            imageClassName
          )}
        />
      )}

      {/* Loading 机制保留你原有的 UI 设计语言 */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm z-10 transition">
          <Spinner className="size-8 text-gray-400" strokeWidth="1.5" />
        </div>
      )}

      {/* 容错与无码流降级兜底 UI */}
      {(status === "error" || !finalSrc) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bz-10">
          <ImageOff className="size-8 text-gray-400" strokeWidth="1.5" />
        </div>
      )}
    </div>
  );
}
