"use client";
import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type SmartImageProps = {
  src?: string | null;
  alt: string;
  refreshKey?: number;
  minLoadingMs?: number;
  className?: string;
  autoRetry?: boolean;
};

export function SmartImage({
                             src,
                             alt,
                             refreshKey,
                             minLoadingMs = 300,
                             className = "",
                             autoRetry = false
                           }: SmartImageProps) {
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [loadStartTime, setLoadStartTime] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);

  const isBlobOrDataUrl =
    src?.startsWith("blob:") || src?.startsWith("data:");

  const cacheBustedSrc =
    src && !isBlobOrDataUrl
      ? `${src}${src.includes("?") ? "&" : "?"}_cb=${refreshKey ?? Date.now()}_${attempt}`
      : src;

  const handleSuccess = useCallback(() => {
    const elapsed = Date.now() - loadStartTime;
    const delay = elapsed >= minLoadingMs ? 0 : minLoadingMs - elapsed;
    setTimeout(() => {
      setStatus("success");
    }, delay);
  }, [loadStartTime, minLoadingMs]);

  const handleError = useCallback(() => {
    if (autoRetry && attempt < 10 && src) {
      setStatus("loading");
      const retryDelay = 300 * Math.pow(2, attempt);
      setTimeout(() => {
        setLoadStartTime(Date.now());
        setAttempt(prev => prev + 1);
      }, retryDelay);
    } else {
      setStatus("error");
    }
  }, [autoRetry, attempt, src]);

  useEffect(() => {
    setStatus("loading");
    setAttempt(0);
    setLoadStartTime(Date.now());
  }, [src, refreshKey]);

  return (
    <div className={cn("w-full h-full relative group", className)}>
      {cacheBustedSrc && (
        <img
          src={cacheBustedSrc ?? ""}
          alt={alt}
          className={cn(
            "transition-opacity duration-500 object-cover w-full h-full",
            status === "success" ? "opacity-100" : "opacity-0"
          )}
          onLoad={handleSuccess}
          onError={handleError}
        />
      )}

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-8 text-gray-400" strokeWidth="1.5"/>
        </div>
      )}

      {(status === "error" || !cacheBustedSrc) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <ImageOff className="size-8 text-gray-400" strokeWidth="1.5"/>
        </div>
      )}
    </div>
  );
}