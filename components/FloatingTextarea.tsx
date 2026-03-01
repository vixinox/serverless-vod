'use client'

import { cn } from "@/lib/utils";
import { ChangeEvent, TextareaHTMLAttributes, useState } from "react";
import { WandSparkles } from "lucide-react";

export interface FloatingTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  maxLength: number;
  error?: string;
  initialHeight?: number;
  needAI?: boolean;
}

export function FloatingTextarea({
  label,
  placeholder,
  maxLength,
  error: externalError,
  initialHeight,
  rows = 3,
  value: externalValue = "",
  onChange,
  needAI = false,
  ...props
}: FloatingTextareaProps) {
  const [value, setValue] = useState(externalValue);
  const [aiError, setAiError] = useState<string | undefined>(undefined);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (e.target.value.length > 0) setAiError(undefined);
    onChange?.(e);
  };

  const mergedError = aiError || externalError;

  return (
    <div
      className={cn(
        "relative w-full flex flex-col transition-all rounded-lg border-2",
        mergedError && "border-destructive"
      )}
    >
      <p className={cn("text-xs text-muted-foreground pt-2 pl-3")}>{label}</p>

      <textarea
        id={label}
        value={value}
        onChange={handleChange}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        style={initialHeight ? { height: initialHeight } : undefined}
        className={cn(
          "min-h-18 whitespace-pre-wrap break-all outline-none peer",
          "placeholder:text-muted-foreground flex field-sizing-content bg-transparent px-3 py-2 text-sm shadow-xs",
        )}
        {...props}
      />

      <div
        className={cn(
          "absolute bottom-1 right-2 text-xs text-muted-foreground transition-opacity opacity-0 peer-focus:opacity-100",
          mergedError && "opacity-100",
          mergedError && "text-destructive"
        )}
      >
        {String(value)?.length ?? 0}/{maxLength}
      </div>

      {needAI && (
        <WandSparkles
          className={cn(
            "absolute top-2 right-2 size-5.5 cursor-pointer transition text-muted-foreground hover:text-foreground",
            mergedError && "text-destructive",
          )}
          strokeWidth="1.5"
        />
      )}

      {mergedError && (
        <p className="text-xs text-destructive px-3 pb-2 transition">{mergedError}</p>
      )}
    </div>
  );
}