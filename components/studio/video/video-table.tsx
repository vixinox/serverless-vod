"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  AlertCircle,
  CircleStop,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Loader2,
  MessageSquareText,
  MoreVertical,
  Pencil,
  RefreshCcw,
  RotateCw,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  TvMinimalPlay,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import Link from "next/link";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  ListUserVideosResult,
  ProcessingStatusItem,
} from "@/lib/server/videos";

type VideoRow = ListUserVideosResult["videos"][number];

const PENDING_STATUSES = new Set(["UPLOADING", "PROCESSING"]);
const POLL_INTERVAL_MS = 5000;

type VisibilityKey = "PUBLIC" | "PRIVATE" | "UNLISTED" | "DRAFT";

const VISIBILITY_OPTIONS: VisibilityKey[] = ["PUBLIC", "UNLISTED", "PRIVATE", "DRAFT"];

const visibilityConfig: Record<
  VisibilityKey,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string; dotClass: string }
> = {
  PUBLIC:   { label: "公开",   variant: "secondary", className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",   dotClass: "bg-green-500" },
  UNLISTED: { label: "不公开", variant: "secondary", className: "bg-blue-50  text-blue-700  border-blue-200  dark:bg-blue-950  dark:text-blue-300  dark:border-blue-800",   dotClass: "bg-blue-500" },
  PRIVATE:  { label: "私享",   variant: "secondary", className: "bg-yellow-50  text-yellow-700  border-yellow-200  dark:bg-yellow-950  dark:text-yellow-300  dark:border-yellow-800",   dotClass: "bg-yellow-500" },
  DRAFT:    { label: "草稿",   variant: "secondary", className: "bg-zinc-50  text-zinc-500  border-zinc-200  dark:bg-zinc-900  dark:text-zinc-400  dark:border-zinc-700",   dotClass: "bg-zinc-400" },
};

const stageLabels: Record<string, string> = {
  job_started: "准备中",
  downloading: "下载原视频",
  probing: "分析媒体信息",
  transcoding: "转码中",
  uploading_segments: "上传分片",
  thumbnail_extracting: "提取封面",
  thumbnail_uploading: "上传封面",
};

function calcLikeRatio(likes: number, dislikes: number) {
  return ((likes / Math.max(likes + dislikes, 1)) * 100).toFixed(1);
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function ProcessingStatusBadge({
  processingStatus,
  stage,
  error,
}: {
  processingStatus: string;
  stage?: string | null;
  error?: string | null;
}) {
  if (processingStatus === "UPLOADING") {
    return (
      <Badge variant="secondary" className="gap-1.5  font-normal">
        <Loader2 className="size-3 animate-spin" />
        上传中
      </Badge>
    );
  }
  if (processingStatus === "PROCESSING") {
    const label = stage ? (stageLabels[stage] ?? stage) : "处理中";
    return (
      <Badge variant="secondary" className="gap-1.5  font-normal">
        <Loader2 className="size-3 animate-spin" />
        {label}
      </Badge>
    );
  }
  if (processingStatus === "FAILED") {
    const badgeEl = (
      <Badge variant="destructive" className="gap-1.5  font-normal">
        <AlertCircle className="size-3" />
        转码失败
      </Badge>
    );
    if (!error) return badgeEl;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{badgeEl}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-52 wrap-break-word ">{error}</TooltipContent>
      </Tooltip>
    );
  }
  return null;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatWallSeconds(value: number | null) {
  if (value === null) return "—";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function JobStatusBadge({ status }: { status: string }) {
  if (status === "SUCCEEDED") {
    return <Badge className="rounded-sm border-emerald-200 bg-emerald-50 text-emerald-700">成功</Badge>;
  }
  if (status === "FAILED") {
    return <Badge variant="destructive" className="rounded-sm">失败</Badge>;
  }
  if (status === "RUNNING") {
    return (
      <Badge variant="secondary" className="rounded-sm gap-1.5">
        <Loader2 className="size-3 animate-spin" />
        运行中
      </Badge>
    );
  }
  if (status === "QUEUED") {
    return <Badge variant="secondary" className="rounded-sm">排队中</Badge>;
  }
  if (status === "CANCELED") {
    return <Badge variant="outline" className="rounded-sm">已取消</Badge>;
  }
  return <Badge variant="outline" className="rounded-sm">{status}</Badge>;
}

function VisibilityCell({
  video,
  onVisibilityChange,
}: {
  video: VideoRow;
  onVisibilityChange: (shortCode: string, visibility: VisibilityKey) => void;
}) {
  const [current, setCurrent] = useState<VisibilityKey>(
    (video.visibility as VisibilityKey) ?? "DRAFT",
  );
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const cfg = visibilityConfig[current] ?? visibilityConfig.DRAFT;

  const handleSelect = async (next: VisibilityKey) => {
    if (next === current || saving) return;
    setSaving(true);
    const prev = current;
    setCurrent(next); // optimistic
    setOpen(false);
    try {
      await apiRequest(`/api/studio/videos/${video.shortCode}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ visibility: next }),
      });
      onVisibilityChange(video.shortCode, next);
    } catch {
      setCurrent(prev);
      toast.error("修改公开范围失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="w-20">
        <PopoverTrigger asChild>
          <Badge
            variant={cfg.variant}
            className={`cursor-pointer select-none rounded-full px-1.5 gap-1.5 border ${cfg.className}`}
          >
            <span className="inline-flex size-3 items-center justify-center shrink-0">
              {saving
                ? <Loader2 className="size-3 animate-spin" />
                : <span className={`inline-block size-1.5 rounded-full ${cfg.dotClass}`} />}
            </span>
            {cfg.label}
          </Badge>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-32 p-1">
        <div className="flex flex-col">
          {VISIBILITY_OPTIONS.map((v) => {
            const c = visibilityConfig[v];
            const isActive = v === current;
            return (
              <button
                key={v}
                onClick={() => handleSelect(v)}
                disabled={isActive || saving}
                className={`flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } disabled:cursor-default`}
              >
                <span className={`inline-block size-2 shrink-0 rounded-full ${c.dotClass}`} />
                {c.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function createColumns(
  pollDetails: Record<string, ProcessingStatusItem>,
  options: {
    pendingShortCode: string | null;
    onRetry: (video: VideoRow) => Promise<void>;
    onCancel: (video: VideoRow) => Promise<void>;
    onDelete: (video: VideoRow) => Promise<void>;
    onVisibilityChange: (shortCode: string, visibility: VisibilityKey) => void;
  },
): ColumnDef<VideoRow>[] {
  const { pendingShortCode, onRetry, onCancel, onDelete, onVisibilityChange } = options;

  const getEffectiveStatus = (video: VideoRow) =>
    pollDetails[video.shortCode]?.processingStatus ?? video.processingStatus;

  const getPollDetail = (video: VideoRow) => pollDetails[video.shortCode] ?? null;

  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="全选"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="选择行"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "title",
      header: "视频",
      cell: ({ row }) => {
        const video = row.original;
        const ps = getEffectiveStatus(video);
        const detail = getPollDetail(video);
        const isPending = PENDING_STATUSES.has(ps);

        // "观看" button only when playable
        const buttons = [
          { title: "详细信息", icon: Pencil, url: "/studio/contents/video/" },
          { title: "数据分析", icon: ChartColumn, url: "/studio/analytics/" },
          { title: "评论", icon: MessageSquareText, url: "/studio/comments/" },
          ...(ps === "READY"
            ? [{ title: "观看", icon: TvMinimalPlay, url: "/watch/" }]
            : []),
        ];

        return (
          <div className={`flex min-w-72 items-center gap-3 ${isPending ? "opacity-70" : ""}`}>
            <div className="relative h-18 w-32 shrink-0 overflow-hidden rounded-sm border border-border/80 bg-muted">
              <SmartImage src={video.thumbnail} alt={video.title} />
              {video.duration && !isPending && (
                <div className="absolute right-1 bottom-1 bg-black/75 px-1 py-0.5  text-white">
                  {formatDuration(video.duration)}
                </div>
              )}
              {isPending && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="size-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="w-full min-w-0">
              <div className="mt-2 ml-1 truncate text-sm">{video.title}</div>
              {ps !== "READY" && (
                <div className="ml-1 mt-1">
                  <ProcessingStatusBadge
                    processingStatus={ps}
                    stage={detail?.pipelineStage}
                    error={detail?.jobError}
                  />
                </div>
              )}
              <div className="mt-1 flex gap-1">
                {buttons.map((item) => (
                  <Tooltip key={item.title}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-sm opacity-0 transition-opacity duration-100 group-hover:opacity-100"
                        asChild
                      >
                        <Link
                          href={item.url + video.shortCode}
                          prefetch={false}
                          target={item.url === "/watch/" ? "_blank" : "_self"}
                        >
                          <item.icon className="size-4" strokeWidth={1.25} />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{item.title}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        );
      },
      enableHiding: false,
    },
    {
      accessorKey: "visibility",
      header: "公开范围",
      cell: ({ row }) => {
        const ps = getEffectiveStatus(row.original);
        if (PENDING_STATUSES.has(ps)) {
          return <span className="text-muted-foreground ">—</span>;
        }
        return (
          <VisibilityCell
            video={row.original}
            onVisibilityChange={onVisibilityChange}
          />
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "日期",
      cell: ({ row }) => (
        <div>
          {new Date(row.original.createdAt).toLocaleDateString()}
          <p className="text-muted-foreground ">上传</p>
        </div>
      ),
    },
    {
      accessorKey: "views",
      header: "观看次数",
      cell: ({ row }) => {
        const ps = getEffectiveStatus(row.original);
        if (PENDING_STATUSES.has(ps))
          return <span className="text-muted-foreground ">—</span>;
        return Number(row.original.views).toLocaleString();
      },
    },
    {
      accessorKey: "commentsCount",
      header: "评论数",
      cell: ({ row }) => {
        const ps = getEffectiveStatus(row.original);
        if (PENDING_STATUSES.has(ps))
          return <span className="text-muted-foreground ">—</span>;
        return row.original.commentsCount.toLocaleString();
      },
    },
    {
      id: "likeRatio",
      header: "赞踩比",
      cell: ({ row }) => {
        const ps = getEffectiveStatus(row.original);
        if (PENDING_STATUSES.has(ps))
          return <span className="text-muted-foreground ">—</span>;
        const { likesCount, dislikesCount } = row.original;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default">
                {calcLikeRatio(Number(likesCount), Number(dislikesCount))}%
              </span>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-3 rounded-sm px-4">
              <ThumbsUp className="size-4" />
              <p>{Number(likesCount).toLocaleString("en-US")}</p>
              <ThumbsDown className="size-4 ml-4" />
              <p>{Number(dislikesCount).toLocaleString("en-US")}</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const video = row.original;
        const status = getEffectiveStatus(video);
        const isPendingAction = pendingShortCode === video.shortCode;
        const canWatch = status === "READY";
        const canRetry = status === "FAILED";
        const canCancel = PENDING_STATUSES.has(status);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="flex size-8 rounded-sm text-muted-foreground data-[state=open]:bg-muted"
              >
                <MoreVertical className="size-4" />
                <span className="sr-only">操作菜单</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-sm">
              <DropdownMenuItem asChild>
                <Link href={`/studio/contents/video/${video.shortCode}`}>编辑</Link>
              </DropdownMenuItem>
              {canWatch ? (
                <DropdownMenuItem asChild>
                  <Link href={`/watch/${video.shortCode}`} target="_blank">
                    观看
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {canRetry ? (
                <DropdownMenuItem
                  disabled={isPendingAction}
                  onSelect={(event) => {
                    event.preventDefault();
                    void onRetry(video);
                  }}
                >
                  <RefreshCcw className="size-4" />
                  失败重试
                </DropdownMenuItem>
              ) : null}
              {canCancel ? (
                <DropdownMenuItem
                  disabled={isPendingAction}
                  onSelect={(event) => {
                    event.preventDefault();
                    void onCancel(video);
                  }}
                >
                  <CircleStop className="size-4" />
                  取消任务
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isPendingAction}
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  void onDelete(video);
                }}
              >
                <Trash2 className="size-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

export const VideoTable = () => {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [pollDetails, setPollDetails] = useState<Record<string, ProcessingStatusItem>>({});
  const [pendingActionShortCode, setPendingActionShortCode] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  const reqIdRef = useRef(0);
  const pageCount = Math.ceil(totalCount / pagination.pageSize) || 1;

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    const myReqId = ++reqIdRef.current;
    try {
      const searchParams = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        pageSize: String(pagination.pageSize),
      });
      if (debouncedTerm) {
        searchParams.set("searchTerm", debouncedTerm);
      }

      const result = await apiRequest<ListUserVideosResult>(
        `/api/studio/videos?${searchParams.toString()}`
      );
      if (myReqId === reqIdRef.current) {
        setVideos(result.videos);
        setTotalCount(result.totalCount);
        setPollDetails((prev) => {
          const allowed = new Set(result.videos.map((video) => video.shortCode));
          const next: Record<string, ProcessingStatusItem> = {};
          Object.entries(prev).forEach(([shortCode, detail]) => {
            if (allowed.has(shortCode)) next[shortCode] = detail;
          });
          return next;
        });
      }
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, debouncedTerm]);

  const runRetry = useCallback(async (video: VideoRow) => {
    setPendingActionShortCode(video.shortCode);
    try {
      await apiRequest(`/api/studio/videos/${video.shortCode}/retry`, {
        method: "POST",
      });
      toast.success("已创建新的转码任务");
      await fetchVideos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重试失败");
    } finally {
      setPendingActionShortCode(null);
    }
  }, [fetchVideos]);

  const runCancel = useCallback(async (video: VideoRow) => {
    setPendingActionShortCode(video.shortCode);
    try {
      await apiRequest(`/api/studio/videos/${video.shortCode}/cancel`, {
        method: "POST",
      });
      toast.success("已取消当前任务");
      await fetchVideos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "取消失败");
    } finally {
      setPendingActionShortCode(null);
    }
  }, [fetchVideos]);

  const runDelete = useCallback(async (video: VideoRow) => {
    const confirmed = window.confirm(`确定删除视频「${video.title}」吗？删除后将从内容列表中移除。`);
    if (!confirmed) return;

    setPendingActionShortCode(video.shortCode);
    try {
      await apiRequest(`/api/studio/videos/${video.shortCode}`, {
        method: "DELETE",
      });
      setVideos((prev) => prev.filter((item) => item.shortCode !== video.shortCode));
      setPollDetails((prev) => {
        const { [video.shortCode]: _removed, ...rest } = prev;
        return rest;
      });
      toast.success("视频已删除");
      await fetchVideos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setPendingActionShortCode(null);
    }
  }, [fetchVideos]);

  const handleVisibilityChange = useCallback(
    (shortCode: string, visibility: VisibilityKey) => {
      setVideos((prev) =>
        prev.map((v) =>
          v.shortCode === shortCode ? { ...v, visibility: visibility as VideoRow["visibility"] } : v,
        ),
      );
    },
    [],
  );

  const columns = useMemo(
    () =>
      createColumns(pollDetails, {
        pendingShortCode: pendingActionShortCode,
        onRetry: runRetry,
        onCancel: runCancel,
        onDelete: runDelete,
        onVisibilityChange: handleVisibilityChange,
      }),
    [pollDetails, pendingActionShortCode, runRetry, runCancel, runDelete, handleVisibilityChange],
  );

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Poll pending videos every 5s; refresh table when status transitions to terminal
  useEffect(() => {
    const pendingCodes = videos
      .filter((v) => PENDING_STATUSES.has(v.processingStatus))
      .map((v) => v.shortCode);

    if (pendingCodes.length === 0) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const searchParams = new URLSearchParams();
        pendingCodes.forEach((shortCode) => {
          searchParams.append("shortCode", shortCode);
        });
        const statuses = await apiRequest<ProcessingStatusItem[]>(
          `/api/studio/videos/processing-statuses?${searchParams.toString()}`
        );
        if (cancelled) return;

        setPollDetails((prev) => {
          const next = { ...prev };
          statuses.forEach((s) => {
            next[s.shortCode] = s;
          });
          return next;
        });

        const readyCount = statuses.filter(
          (s) => s.processingStatus === "READY" && pendingCodes.includes(s.shortCode)
        ).length;
        const failedCount = statuses.filter(
          (s) => s.processingStatus === "FAILED" && pendingCodes.includes(s.shortCode)
        ).length;

        if ((readyCount > 0 || failedCount > 0) && !cancelled) {
          if (readyCount > 0)
            toast.success(`${readyCount} 个视频处理完成，已可发布`);
          if (failedCount > 0)
            toast.error(`${failedCount} 个视频转码失败`);
          void fetchVideos();
        }
      } catch {
        // silently ignore transient polling errors
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [videos, fetchVideos]);

  const table = useReactTable({
    data: videos,
    columns,
    pageCount,
    state: { sorting, columnVisibility, rowSelection, columnFilters, pagination },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    manualPagination: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col pb-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 rounded-sm border border-border/80 bg-background px-3 py-2">
        <div className="relative flex flex-1 items-center gap-2">
          {loading && (
            <div className="absolute -top-2 left-0 h-0.5 w-full overflow-hidden">
              <div className="h-full animate-loading-bar bg-foreground/70" />
            </div>
          )}
          <Button className="rounded-full" variant="outline" size="icon-sm" onClick={() => fetchVideos()} disabled={loading}>
            <RotateCw className="size-4" strokeWidth={1.5} />
          </Button>
          <Input
            placeholder="搜索"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 max-w-sm rounded-sm border-border/80 bg-background"
          />
          {pendingActionShortCode ? (
            <span className=" text-muted-foreground">正在同步 {pendingActionShortCode}</span>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-sm">
              <Columns3 className="size-4" />
              <span className="hidden lg:inline">自定义列</span>
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-sm">
            {table
              .getAllColumns()
              .filter((col) => typeof col.accessorFn !== "undefined" && col.getCanHide())
              .map((col) => {
                const labelMap: Record<string, string> = {
                  visibility: "公开范围",
                  createdAt: "日期",
                  views: "观看次数",
                  commentsCount: "评论数",
                };
                return (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  >
                    {labelMap[col.id] ?? col.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-none border border-border/80 bg-background">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur supports-backdrop-filter:bg-muted/55">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className="h-11 border-b border-border/80 text-[11px] tracking-wide text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="group border-b border-border/70 hover:bg-muted/30 data-[state=selected]:bg-muted/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="h-18 px-2.5 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {loading ? "加载中..." : "暂无视频"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-border/80 px-1 pt-3">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex ml-4">
          已选 {table.getFilteredSelectedRowModel().rows.length} / {totalCount} 条
        </div>
        <div className="flex w-full items-center gap-6 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium whitespace-nowrap">
              每页行数
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger size="sm" className="w-20 rounded-sm" id="rows-per-page">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium whitespace-nowrap">
            第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden size-8 rounded-sm lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">首页</span>
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 rounded-sm"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">上一页</span>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 rounded-sm"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">下一页</span>
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 rounded-sm lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">末页</span>
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
