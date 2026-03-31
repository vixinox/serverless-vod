"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FloatingTextarea } from "@/components/FloatingTextarea";
import { Button } from "@/components/ui/button";
import { VideoInfoCard } from "./video-info-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  LockKeyhole,
  RotateCw,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { VideoProcessingStatus, Visibility } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SmartImage } from "@/components/smart-image";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/player/video-player";
import { apiRequest } from "@/lib/api-client";
import { useStudioTransition } from "@/components/studio/basic/studio-transition";

interface VideoFormProps {
  isInDialog?: boolean;
  imageDomain: string;
  onComplete?: () => void;
  video: {
    title: string;
    description: string | undefined;
    thumbnail: string | undefined;
    visibility: Visibility;
    shortCode: string;
    qualityPresets?: string[];
    processingStatus: VideoProcessingStatus;
    processingError?: string | null;
  };
}

type SavePhase =
  | "idle"
  | "uploading-thumbnail"
  | "saving-video"
  | "saved"
  | "error";

const visibilityMap: Record<Visibility, string> = {
  PUBLIC: "公开",
  PRIVATE: "私享",
  UNLISTED: "不公开",
  DRAFT: "草稿",
};

const visibilityDescriptions: Record<Visibility, string> = {
  PRIVATE: "仅自己可见",
  UNLISTED: "只能通过视频链接访问",
  PUBLIC: "所有人可见",
  DRAFT: "暂不对外展示，稍后再继续编辑",
};

const visibilityOptions: Visibility[] = [
  Visibility.DRAFT,
  Visibility.PRIVATE,
  Visibility.UNLISTED,
  Visibility.PUBLIC,
];

const processingStatusCopy: Record<VideoProcessingStatus, { label: string; tone: string; hint: string }> = {
  UPLOADING: {
    label: "上传中",
    tone: "bg-amber-50 text-amber-700 border-amber-200",
    hint: "原视频仍在上传，右侧预览会在资源就绪后自动可用。",
  },
  PROCESSING: {
    label: "处理中",
    tone: "bg-blue-50 text-blue-700 border-blue-200",
    hint: "转码和切片还在进行中，画质信息会在完成后出现。",
  },
  READY: {
    label: "可预览",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    hint: "当前视频已可播放，右侧预览和画质信息都已可用。",
  },
  FAILED: {
    label: "处理失败",
    tone: "bg-red-50 text-red-700 border-red-200",
    hint: "当前视频未能处理成功，建议先排查失败原因或重新发起任务。",
  },
};

const formSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(150, "标题不能超过150个字符"),
  description: z.string().max(5000, "描述不能超过5000个字符"),
  thumbnail: z.string().optional(),
  visibility: z.enum(Visibility),
});

export function VideoForm({
  isInDialog = false,
  imageDomain,
  video,
  onComplete,
}: VideoFormProps) {
  const router = useRouter();
  const { setNavigationGuard } = useStudioTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(video.thumbnail ?? "");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [imageKey, setImageKey] = useState<number>(0);
  const [savePhase, setSavePhase] = useState<SavePhase>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const ignoreNextPopStateRef = useRef(false);
  const savedSnapshotRef = useRef({
    title: video.title ?? "",
    description: video.description ?? "",
    thumbnail: video.thumbnail ?? "",
    visibility: video.visibility ?? Visibility.PRIVATE,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: savedSnapshotRef.current,
  });

  const visibility = form.watch("visibility");
  const persistedThumbnail = form.watch("thumbnail");
  const isDirty = form.formState.isDirty;
  const statusMeta = processingStatusCopy[video.processingStatus];
  const isPlayable = video.processingStatus === VideoProcessingStatus.READY;
  const currentThumbnail = thumbnailFile
    ? thumbnailPreview
    : (persistedThumbnail || savedSnapshotRef.current.thumbnail || "");
  const previewSrc = isPlayable
    ? `/api/hls/${encodeURIComponent(video.shortCode)}/master.m3u8`
    : "";
  const leaveMessage = "你有未保存的更改，离开此页面后这些修改将会丢失。确定要离开吗？";

  const saveStatusText = useMemo(() => {
    if (isSubmitting) {
      if (savePhase === "uploading-thumbnail") return "正在上传缩略图...";
      if (savePhase === "saving-video") return "正在保存视频信息...";
      return "正在保存...";
    }

    if (isDirty) return "有未保存的更改";
    if (savePhase === "saved" && lastSavedAt) {
      return `已保存于 ${lastSavedAt.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    if (savePhase === "error") return "保存失败，请重试";
    return "尚未修改";
  }, [isDirty, isSubmitting, lastSavedAt, savePhase]);

  useEffect(() => {
    if (savePhase === "saved" && isDirty) {
      setSavePhase("idle");
    }
  }, [isDirty, savePhase]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isInDialog) return;

    const shouldBlockNavigation = isDirty && !isSubmitting;
    setNavigationGuard(shouldBlockNavigation ? () => window.confirm(leaveMessage) : null);

    return () => {
      setNavigationGuard(null);
    };
  }, [isDirty, isInDialog, isSubmitting, leaveMessage, setNavigationGuard]);

  useEffect(() => {
    if (isInDialog || !isDirty || isSubmitting || typeof window === "undefined") {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePopState = () => {
      if (ignoreNextPopStateRef.current) {
        ignoreNextPopStateRef.current = false;
        return;
      }

      const shouldLeave = window.confirm(leaveMessage);
      if (!shouldLeave) {
        ignoreNextPopStateRef.current = true;
        window.history.go(1);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty, isInDialog, isSubmitting, leaveMessage]);

  function resetToSavedSnapshot() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setThumbnailFile(null);
    setThumbnailPreview(savedSnapshotRef.current.thumbnail);
    form.reset(savedSnapshotRef.current);
  }

  function handleThumbnailSelect(file?: File) {
    if (!file) return;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setThumbnailFile(file);
    setThumbnailPreview(objectUrl);
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
        setSavePhase("uploading-thumbnail");
        thumbnailUrl = await uploadThumbnail();
      }

      setSavePhase("saving-video");
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

      savedSnapshotRef.current = {
        title: values.title,
        description: values.description,
        thumbnail: thumbnailUrl ?? "",
        visibility: values.visibility,
      };

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      setThumbnailFile(null);
      setThumbnailPreview(thumbnailUrl ?? "");
      form.reset(savedSnapshotRef.current);
      setLastSavedAt(new Date());
      setSavePhase("saved");
      toast.success("视频信息已成功保存");
      onComplete?.();
    } catch (err) {
      console.error(err);
      setSavePhase("error");
      toast.error(err instanceof Error ? err.message : "保存视频信息失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    try {
      setIsSubmitting(true);
      await apiRequest(`/api/studio/videos/${video.shortCode}`, {
        method: "DELETE",
      });
      setDeleteDialogOpen(false);
      toast.success("视频已删除");
      onComplete?.();

      if (!isInDialog) {
        router.push("/studio/contents");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除视频失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn("flex h-full", isInDialog ? "w-full p-3" : "min-w-248")}
        >
          <div className={cn("p-4.5 ml-1.5 space-y-5", isInDialog ? "w-2/3" : "min-w-160")}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-2xl">{video.title}</h1>
                <Badge variant="outline" className={cn("rounded-full", statusMeta.tone)}>
                  {statusMeta.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                编辑视频详细信息，链接代号为 <span className="font-mono">{video.shortCode}</span>
              </p>
            </div>

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
                          onClick={() => setImageKey((current) => current + 1)}
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
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            handleThumbnailSelect(file);
                          }
                        }}
                        disabled={isSubmitting}
                      />
                      <label
                        htmlFor="thumbnailInput"
                        className="mt-3 flex h-36 w-64 cursor-pointer items-center justify-center overflow-hidden rounded border-2 border-dashed bg-muted transition hover:border-blue-500"
                      >
                        <SmartImage
                          src={currentThumbnail}
                          alt="缩略图预览"
                          refreshKey={imageKey}
                        />
                      </label>
                      <p className="mt-2 text-xs text-muted-foreground">
                        建议使用清晰、高对比度的封面图，保存后会立即替换右侧预览封面。
                      </p>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="p-4.5 w-88 space-y-6">
            {!isInDialog && (
              <div className="flex w-full items-start justify-between gap-3">
                <div className="min-h-9 text-sm text-muted-foreground">
                  <p
                    className={cn(
                      "transition-colors",
                      savePhase === "error" && "text-destructive",
                      isDirty && "text-foreground",
                    )}
                  >
                    {saveStatusText}
                  </p>
                  {!isPlayable ? (
                    <p className="mt-1 text-xs">{statusMeta.hint}</p>
                  ) : null}
                </div>
                <div className="flex gap-3">
                  <Button
                    className="rounded-full cursor-pointer"
                    variant="outline"
                    type="button"
                    onClick={resetToSavedSnapshot}
                    disabled={!isDirty || isSubmitting}
                  >
                    撤销更改
                  </Button>
                  <Button
                    className="rounded-full cursor-pointer"
                    variant="outline"
                    type="submit"
                    disabled={!isDirty || isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isSubmitting ? "保存中..." : "保存"}
                  </Button>
                  <Button
                    className="rounded-full cursor-pointer"
                    variant="destructive"
                    type="button"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={isSubmitting}
                  >
                    删除
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {isPlayable ? (
                <VideoPlayer src={previewSrc} thumbnail={currentThumbnail} compact />
              ) : (
                <Card className="space-y-3 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    {video.processingStatus === VideoProcessingStatus.FAILED ? (
                      <AlertTriangle className="size-5 text-destructive" />
                    ) : (
                      <Clock3 className="size-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">预览暂不可用</p>
                      <p className="text-xs text-muted-foreground">{statusMeta.hint}</p>
                    </div>
                  </div>
                  {video.processingError ? (
                    <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive break-all">
                      {video.processingError}
                    </p>
                  ) : null}
                </Card>
              )}

              <VideoInfoCard
                shortCode={video.shortCode}
                processingStatus={video.processingStatus}
                processingError={video.processingError}
                qualityPresets={video.qualityPresets}
              />

              <Popover>
                <PopoverTrigger asChild className="w-full">
                  <Card className="cursor-pointer gap-2.5 p-2 transition hover:border-blue-500">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-2">
                        <p className="ml-1 text-xs text-muted-foreground">公开范围</p>
                        <div className="flex px-2 pb-2.5">
                          <LockKeyhole className="size-5" strokeWidth="1.5" />
                          <p className="ml-2 text-sm">{visibilityMap[visibility]}</p>
                        </div>
                      </div>
                      <ChevronDown className="mr-2 size-8" strokeWidth="1" />
                    </div>
                  </Card>
                </PopoverTrigger>
                <PopoverContent side="left" className="pointer-events-auto">
                  <FormField
                    control={form.control}
                    name="visibility"
                    render={({ field }) => (
                      <RadioGroup value={field.value} onValueChange={field.onChange}>
                        {visibilityOptions.map((option) => (
                          <div key={option} className="flex items-start gap-3">
                            <RadioGroupItem value={option} id={`visibility-${option}`} />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Label htmlFor={`visibility-${option}`} className="cursor-pointer space-y-0.5">
                                  <div>{visibilityMap[option]}</div>
                                  <p className="text-xs font-normal text-muted-foreground">
                                    {visibilityDescriptions[option]}
                                  </p>
                                </Label>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p>{visibilityDescriptions[option]}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                  />
                </PopoverContent>
              </Popover>

              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {visibility === Visibility.PUBLIC ? (
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    保存后会立即公开给所有人。
                  </div>
                ) : visibility === Visibility.DRAFT ? (
                  "草稿模式适合继续整理标题、说明和封面，保存后仍不会对外展示。"
                ) : (
                  "修改公开范围后仍需要点击“保存”才会真正生效。"
                )}
              </div>
            </div>
          </div>

          {isInDialog && (
            <div className="absolute bottom-0 left-0 flex h-17 w-full items-center justify-end border-t">
              <Button
                className="mr-5 rounded-full font-bold cursor-pointer"
                type="submit"
                disabled={!isDirty || isSubmitting}
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {isSubmitting ? "提交中..." : "继续"}
              </Button>
            </div>
          )}
        </form>
      </Form>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle>删除这条视频？</DialogTitle>
            <DialogDescription>
              视频「{savedSnapshotRef.current.title}」删除后会从内容列表中移除，且当前页面的未保存修改也会一并丢失。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
