import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CopyButtonProps {
  title: string;
  content: string;
}

export function CopyButton({ title, content }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.error("复制失败", err);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          className={`relative w-5 h-5 flex items-center justify-center 
                  ${copied ? "pointer-events-none" : "cursor-pointer"}`}
        >
          <Copy
            strokeWidth={1.5}
            className={`absolute transition-opacity duration-300 
                    ${copied ? "opacity-0" : "opacity-100"}`}
          />
          <Check
            strokeWidth={1.5}
            className={`absolute text-green-500 duration-300 transform 
                    ${copied ? "opacity-100" : "opacity-0"}`}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  )
}