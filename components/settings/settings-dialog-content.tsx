"use client";

import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSettings } from "@/hooks/use-settings";
import { ThemePreference } from "@prisma/client";
import { Monitor, Moon, Sun } from "lucide-react";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: React.ElementType }[] = [
  { value: "LIGHT", label: "浅色", icon: Sun },
  { value: "DARK", label: "深色", icon: Moon },
  { value: "SYSTEM", label: "跟随系统", icon: Monitor },
];

export function SettingsDialogContent() {
  const { settings, applyLocalTheme } = useSettings();

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>设置</DialogTitle>
        <DialogDescription>调整你的偏好，关闭对话框后自动保存。</DialogDescription>
      </DialogHeader>

      <div className="py-2 space-y-4">
        <div>
          <p className="text-sm font-medium mb-3">主题</p>
          <RadioGroup
            value={settings.theme}
            onValueChange={(v) => applyLocalTheme(v as ThemePreference)}
            className="grid grid-cols-3 gap-3"
          >
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Label
                key={value}
                htmlFor={`theme-${value}`}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer
                  hover:bg-accent/60 transition-colors
                  [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-accent/40"
              >
                <RadioGroupItem value={value} id={`theme-${value}`} className="sr-only" />
                <Icon className="size-5" />
                <span className="text-sm">{label}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </div>
    </DialogContent>
  );
}
