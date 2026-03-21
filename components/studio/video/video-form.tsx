"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FloatingTextarea } from "@/components/FloatingTextarea";
import { Button } from "@/components/ui/button";
import { VideoInfoCard } from "./video-info-card";
import { Card } from "@/components/ui/card";
import { ChevronDown, LockKeyhole, RotateCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Visibility } from "@prisma/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SmartImage } from "@/components/smart-image";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/player/video-player";
import { apiRequest } from "@/lib/api-client";

interface VideoFormProps {
  isInDialog?: boolean;
  onComplete?: () => void;
  video: {
    title: string;
    description: string | undefined;
    thumbnail: string | undefined;
    visibility: Visibility;
    shortCode: string;
  };
}

const visibilityMap = {
  PUBLIC: "公开",
  PRIVATE: "私享",
  UNLISTED: "不公开",
  DRAFT: "草稿",
};

const formSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(150, "标题不能超过150个字符"),
  description: z.string().max(5000, "描述不能超过5000个字符"),
  thumbnail: z.string().optional(),
  visibility: z.enum(Visibility),
});

export function VideoForm({ isInDialog = false, video, onComplete }: VideoFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(video.thumbnail ?? "");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [imageKey, setImageKey] = useState<number>(0);
  const [imageDomain, setImageDomain] = useState("");

  useEffect(() => {
    apiRequest<{ imageDomain: string }>("/api/cdn/domains").then(({ imageDomain }) => {
      setImageDomain(imageDomain);
    });
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      title: video.title ?? "",
      description: video.description ?? "",
      thumbnail: video.thumbnail ?? "",
      visibility: video.visibility ?? Visibility.PRIVATE,
    },
  });

  const visibility = form.watch("visibility");
  const previewSrc = `/api/hls/${encodeURIComponent(video.shortCode)}/master.m3u8`;

  function handleThumbnailSelect(file?: File) {
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
    form.setValue("thumbnail", "", { shouldDirty: true });
  }

  async function uploadThumbnail(): Promise<string | undefined> {
    if (!thumbnailFile) return form.getValues("thumbnail");
    const { url } = await apiRequest<{ url: string }>("/api/uploads/thumbnail-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: thumbnailFile.name,
        contentType: thumbnailFile.type,
        shortCode: video.shortCode,
      }),
    });
    const resp = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": thumbnailFile.type },
      body: thumbnailFile,
    });
    if (!resp.ok) {
      throw new Error(`缩略图上传失败: ${resp.statusText}`);
    }
    const ext = thumbnailFile.type.split("/")[1] ?? "jpg";
    return `${imageDomain}/thumbnails/${video.shortCode}/thumbnail.${ext}`;
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);

      let thumbnailUrl = values.thumbnail;
      if (thumbnailFile) {
        thumbnailUrl = await uploadThumbnail();
      }

      await apiRequest(`/api/studio/videos/${video.shortCode}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          thumbnail: thumbnailUrl || undefined,
          visibility: values.visibility,
        }),
      });

      toast.success("视频信息已成功保存");
      if (onComplete) onComplete();
      setThumbnailFile(null);
      form.reset({
        ...values,
        thumbnail: thumbnailUrl,
      });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "保存视频信息失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(`确定删除视频「${video.title}」吗？`);
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await apiRequest(`/api/studio/videos/${video.shortCode}`, {
        method: "DELETE",
      });
      toast.success("视频已删除");
      if (!isInDialog) {
        router.back();
      }
      onComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除视频失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("flex h-full", isInDialog ? "w-full p-3" : "min-w-248")}
      >
        <div className={cn("p-4.5 ml-1.5 space-y-5", isInDialog ? "w-2/3" : "min-w-160")}>
          <h1 className="font-bold text-2xl">视频详细信息</h1>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FloatingTextarea
                    label="标题（必填）"
                    placeholder="添加一个描述视频的标题"
                    maxLength={150}
                    error={form.formState.errors.title?.message}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FloatingTextarea
                    label="说明"
                    placeholder="向观众介绍你的视频"
                    maxLength={5000}
                    rows={6}
                    initialHeight={200}
                    error={form.formState.errors.description?.message}
                    needAI
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="thumbnail"
            render={() => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <p>缩略图</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label="刷新缩略图预览"
                        title="刷新缩略图预览"
                        onClick={() => setImageKey(imageKey + 1)}
                      >
                        <RotateCw className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>刷新缩略图预览</p>
                    </TooltipContent>
                  </Tooltip>
                </FormLabel>
                <FormControl>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="thumbnailInput"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleThumbnailSelect(file);
                        }
                      }}
                      disabled={isSubmitting}
                    />
                    <label
                      htmlFor="thumbnailInput"
                      className="mt-3 w-64 h-36 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:border-blue-500 transition bg-muted relative overflow-hidden"
                    >
                      <SmartImage
                        src={thumbnailPreview}
                        alt="缩略图预览"
                        refreshKey={imageKey}
                      />
                    </label>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="p-4.5 w-88 space-y-6">
          {!isInDialog && (
            <div className="flex justify-end w-full gap-3">
              <Button
                className="rounded-full cursor-pointer"
                variant="outline"
                type="button"
                onClick={() => {
                  setThumbnailFile(null);
                  setThumbnailPreview(video.thumbnail ?? "");
                  form.reset();
                }}
                disabled={!form.formState.isDirty || isSubmitting}
              >
                撤销更改
              </Button>
              <Button
                className="rounded-full cursor-pointer"
                variant="outline"
                type="submit"
                disabled={!form.formState.isDirty || isSubmitting}
              >
                {isSubmitting ? "保存中..." : "保存"}
              </Button>
              <Button
                className="rounded-full cursor-pointer"
                variant="destructive"
                type="button"
                onClick={() => void handleDelete()}
                disabled={isSubmitting}
              >
                删除
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <VideoPlayer src={previewSrc} thumbnail={video.thumbnail} compact/>
            <VideoInfoCard
              shortCode={video.shortCode}
              thumbnail={video.thumbnail}
            />
            <Popover>
              <PopoverTrigger asChild className="w-full">
                <Card className="p-2 gap-2.5 hover:border-blue-500 cursor-pointer transition">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-2 5">
                      <p className="ml-1 text-xs text-muted-foreground">公开范围</p>
                      <div className="flex px-2 pb-2.5">
                        <LockKeyhole className="size-5" strokeWidth="1.5" />
                        <p className="ml-2 text-sm">{visibilityMap[visibility]}</p>
                      </div>
                    </div>
                    <ChevronDown className="size-8 mr-2" strokeWidth="1" />
                  </div>
                </Card>
              </PopoverTrigger>
              <PopoverContent side="left" className="pointer-events-auto">
                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={Visibility.PRIVATE} id="r1" />
                        <Tooltip>
                          <TooltipTrigger>
                            <Label htmlFor="r1">私享</Label>
                          </TooltipTrigger>
                          <TooltipContent side="right"><p>仅自己可见</p></TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={Visibility.UNLISTED} id="r2" />
                        <Tooltip>
                          <TooltipTrigger>
                            <Label htmlFor="r2">不公开</Label>
                          </TooltipTrigger>
                          <TooltipContent side="right"><p>只能通过视频链接访问</p></TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={Visibility.PUBLIC} id="r3" />
                        <Tooltip>
                          <TooltipTrigger>
                            <Label htmlFor="r3">公开</Label>
                          </TooltipTrigger>
                          <TooltipContent side="right"><p>所有人可见</p></TooltipContent>
                        </Tooltip>
                      </div>
                    </RadioGroup>
                  )}
                />
              </PopoverContent>
            </Popover>
            <p className="px-1 text-xs text-muted-foreground">设为公开并保存即发布</p>
          </div>
        </div>

        {isInDialog && (
          <div className="w-full absolute bottom-0 left-0 h-17 border-t flex justify-end items-center">
            <Button
              className="rounded-full font-bold mr-5 cursor-pointer"
              type="submit"
              disabled={!form.formState.isDirty || isSubmitting}
            >
              {isSubmitting ? "提交中..." : "继续"}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
