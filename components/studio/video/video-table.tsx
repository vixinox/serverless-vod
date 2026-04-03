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
  ArrowUpRight,
  CircleStop,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Loader2,
  MoreVertical,
  Pencil,
  RefreshCcw,
  RotateCw,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  TvMinimalPlay,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useStudioTransition } from "@/components/studio/basic/studio-transition";
import type {
  ListUserVideosResult,
  ProcessingStatusItem,
} from "@/lib/server/videos";

type VideoRow = ListUserVideosResult["videos"][number];
type VideoActionButton = {
  title: string;
  icon: LucideIcon;
  href: string;
  kind: "watch" | "studio";
};

type PersistedVideoTableState = {
  searchTerm?: string;
  pagination?: {
    pageIndex?: number;
    pageSize?: number;
  };
  columnVisibility?: VisibilityState;
  sorting?: SortingState;
};

const PENDING_STATUSES = new Set(["UPLOADING", "PROCESSING"]);
const POLL_INTERVAL_MS = 5000;
const VIDEO_TABLE_STATE_KEY = "studio:video-table-state:v1";

function VideoTableSkeletonRows({ rows = 6 }: { rows?: number }) {
  return Array.from({ length: rows }, (_, index) => (
    <TableRow key={`video-skeleton-${index}`} className="border-b border-border/70">
      <TableCell className="h-18 px-2.5 py-2 align-middle">
        <div className="flex items-center justify-center">
          <Skeleton className="size-4 rounded-sm" />
        </div>
      </TableCell>
      <TableCell className="h-18 px-2.5 py-2 align-middle">
        <div className="flex min-w-72 items-center gap-3">
          <Skeleton className="h-18 w-32 rounded-sm" />
          <div className="flex w-full flex-col gap-2">
            <Skeleton className="h-4 w-2/3 rounded-sm" />
            <Skeleton className="h-4 w-24 rounded-full" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-7 rounded-full" />
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="h-18 px-2.5 py-2 align-middle">
        <Skeleton className="h-6 w-18 rounded-full" />
      </TableCell>
      <TableCell className="h-18 px-2.5 py-2 align-middle">
        <Skeleton className="h-4 w-16 rounded-sm" />
        <Skeleton className="mt-1 h-3 w-10 rounded-sm" />
      </TableCell>
      <TableCell className="h-18 px-2.5 py-2 align-middle">
        <Skeleton className="h-4 w-12 rounded-sm" />
      </TableCell>
      <TableCell className="h-18 px-2.5 py-2 align-middle">
        <Skeleton className="h-4 w-10 rounded-sm" />
      </TableCell>
      <TableCell className="h-18 px-2.5 py-2 align-middle">
        <Skeleton className="h-4 w-14 rounded-sm" />
      </TableCell>
      <TableCell className="h-18 px-2.5 py-2 align-middle">
        <div className="flex justify-end">
          <Skeleton className="size-8 rounded-sm" />
        </div>
      </TableCell>
    </TableRow>
  ));
}

type VisibilityKey = "PUBLIC" | "PRIVATE" | "UNLISTED" | "DRAFT";

const VISIBILITY_OPTIONS: VisibilityKey[] = ["PUBLIC", "UNLISTED", "PRIVATE", "DRAFT"];

const visibilityConfig: Record<
  VisibilityKey,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string; dotClass: string }
> = {
  PUBLIC: { label: "公开", variant: "secondary", className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800", dotClass: "bg-green-500" },
  UNLISTED: { label: "不公开", variant: "secondary", className: "bg-blue-50  text-blue-700  border-blue-200  dark:bg-blue-950  dark:text-blue-300  dark:border-blue-800", dotClass: "bg-blue-500" },
  PRIVATE: { label: "私享", variant: "secondary", className: "bg-yellow-50  text-yellow-700  border-yellow-200  dark:bg-yellow-950  dark:text-yellow-300  dark:border-yellow-800", dotClass: "bg-yellow-500" },
  DRAFT: { label: "草稿", variant: "secondary", className: "bg-zinc-50  text-zinc-500  border-zinc-200  dark:bg-zinc-900  dark:text-zinc-400  dark:border-zinc-700", dotClass: "bg-zinc-400" },
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
                className={`flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm transition-colors ${isActive
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
    pendingHref: string | null;
    navigate: (href: string) => void;
    prefetchRoute: (href: string) => void;
    onRetry: (video: VideoRow) => Promise<void>;
    onCancel: (video: VideoRow) => Promise<void>;
    onDelete: (video: VideoRow) => Promise<void>;
    onVisibilityChange: (shortCode: string, visibility: VisibilityKey) => void;
  },
): ColumnDef<VideoRow>[] {
  const {
    pendingShortCode,
    pendingHref,
    navigate,
    prefetchRoute,
    onRetry,
    onCancel,
    onDelete,
    onVisibilityChange,
  } = options;

  const getEffectiveStatus = (video: VideoRow) =>
    pollDetails[video.shortCode]?.processingStatus ?? video.processingStatus;

  const getPollDetail = (video: VideoRow) => pollDetails[video.shortCode] ?? null;

  const handleStudioNavigation = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.currentTarget.target;
    if (target && target !== "_self") return;

    event.preventDefault();
    void navigate(href);
  };

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
        const analyticsHref = `/studio/stat/${video.shortCode}`;
        const detailsHref = `/studio/contents/video/${video.shortCode}`;
        const watchHref = `/watch/${video.shortCode}`;
        const isAnalyticsPending = pendingHref === analyticsHref;
        const isDetailsPending = pendingHref === detailsHref;

        const buttons: VideoActionButton[] =
          ps === "READY"
            ? [{ title: "观看", icon: TvMinimalPlay, href: watchHref, kind: "watch" as const }]
            : [];

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
              <div className="mt-2 ml-1 truncate text-sm font-medium">{video.title}</div>
              {ps !== "READY" && (
                <div className="ml-1 mt-1">
                  <ProcessingStatusBadge
                    processingStatus={ps}
                    stage={detail?.pipelineStage}
                    error={detail?.jobError}
                  />
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  className="h-7 rounded-full border-border/70 bg-background/85 px-2.5 shadow-xs"
                  asChild
                >
                  <Link
                    href={detailsHref}
                    prefetch={false}
                    onMouseEnter={() => prefetchRoute(detailsHref)}
                    onFocus={() => prefetchRoute(detailsHref)}
                    onClick={(event) => handleStudioNavigation(event, detailsHref)}
                    data-pending={isDetailsPending ? "true" : undefined}
                    className="data-[pending=true]:opacity-70"
                  >
                    <Pencil data-icon="inline-start" />
                    编辑
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  className="h-7 rounded-full border-border/70 bg-background/85 px-2.5 shadow-xs"
                  asChild
                >
                  <Link
                    href={analyticsHref}
                    prefetch={false}
                    onMouseEnter={() => prefetchRoute(analyticsHref)}
                    onFocus={() => prefetchRoute(analyticsHref)}
                    onClick={(event) => handleStudioNavigation(event, analyticsHref)}
                    data-pending={isAnalyticsPending ? "true" : undefined}
                    className="data-[pending=true]:opacity-70"
                  >
                    <ChartColumn data-icon="inline-start" />
                    分析
                    <ArrowUpRight data-icon="inline-end" />
                  </Link>
                </Button>
                {buttons.map((item) => (
                  <Tooltip key={item.title}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full opacity-70 transition-[opacity,background-color] duration-150 hover:opacity-100 group-hover:opacity-100"
                        asChild
                      >
                        <Link
                          href={item.href}
                          prefetch={false}
                          target={item.kind === "watch" ? "_blank" : "_self"}
                          onMouseEnter={
                            item.kind === "studio" ? () => prefetchRoute(item.href) : undefined
                          }
                          onFocus={
                            item.kind === "studio" ? () => prefetchRoute(item.href) : undefined
                          }
                          onClick={
                            item.kind === "studio"
                              ? (event) => handleStudioNavigation(event, item.href)
                              : undefined
                          }
                        >
                          <item.icon strokeWidth={1.25} />
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
            <DropdownMenuContent align="end" className="rounded-sm">
              <DropdownMenuItem asChild>
                <Link
                  href={`/studio/contents/video/${video.shortCode}`}
                  onMouseEnter={() => prefetchRoute(`/studio/contents/video/${video.shortCode}`)}
                  onFocus={() => prefetchRoute(`/studio/contents/video/${video.shortCode}`)}
                >
                  编辑
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/studio/stat/${video.shortCode}`}
                  onMouseEnter={() => prefetchRoute(`/studio/stat/${video.shortCode}`)}
                  onFocus={() => prefetchRoute(`/studio/stat/${video.shortCode}`)}
                >
                  数据分析
                </Link>
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

function loadPersistedTableState(): PersistedVideoTableState | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(VIDEO_TABLE_STATE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PersistedVideoTableState;
  } catch {
    window.sessionStorage.removeItem(VIDEO_TABLE_STATE_KEY);
    return null;
  }
}

export const VideoTable = () => {
  const router = useRouter();
  const { navigate, pendingHref } = useStudioTransition();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const [pollDetails, setPollDetails] = useState<Record<string, ProcessingStatusItem>>({});
  const [pendingActionShortCode, setPendingActionShortCode] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoRow | null>(null);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  const reqIdRef = useRef(0);
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const pageCount = Math.ceil(totalCount / pagination.pageSize) || 1;

  useEffect(() => {
    const persistedState = loadPersistedTableState();

    if (persistedState?.searchTerm) {
      setSearchTerm(persistedState.searchTerm);
      setDebouncedTerm(persistedState.searchTerm);
    }

    if (persistedState?.pagination) {
      setPagination((prev) => ({
        pageIndex:
          typeof persistedState.pagination?.pageIndex === "number"
            ? Math.max(0, persistedState.pagination.pageIndex)
            : prev.pageIndex,
        pageSize:
          typeof persistedState.pagination?.pageSize === "number"
            ? Math.min(Math.max(persistedState.pagination.pageSize, 10), 50)
            : prev.pageSize,
      }));
    }

    if (persistedState?.columnVisibility) {
      setColumnVisibility(persistedState.columnVisibility);
    }

    if (persistedState?.sorting) {
      setSorting(persistedState.sorting);
    }

    setHasRestoredState(true);
  }, []);

  useEffect(() => {
    if (!hasRestoredState || typeof window === "undefined") return;

    window.sessionStorage.setItem(
      VIDEO_TABLE_STATE_KEY,
      JSON.stringify({
        searchTerm,
        pagination,
        columnVisibility,
        sorting,
      } satisfies PersistedVideoTableState),
    );
  }, [columnVisibility, hasRestoredState, pagination, searchTerm, sorting]);

  useEffect(() => {
    if (!hasRestoredState) return;

    const t = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      if (searchTerm !== debouncedTerm) {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [debouncedTerm, hasRestoredState, searchTerm]);

  const prefetchRoute = useCallback(
    (href: string) => {
      if (!href || prefetchedRoutesRef.current.has(href)) return;

      prefetchedRoutesRef.current.add(href);
      void router.prefetch(href);
    },
    [router],
  );

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

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setPendingActionShortCode(deleteTarget.shortCode);
    try {
      await apiRequest(`/api/studio/videos/${deleteTarget.shortCode}`, {
        method: "DELETE",
      });
      setVideos((prev) => prev.filter((item) => item.shortCode !== deleteTarget.shortCode));
      setPollDetails((prev) => {
        const { [deleteTarget.shortCode]: _removed, ...rest } = prev;
        return rest;
      });
      toast.success("视频已删除");
      setDeleteTarget(null);
      await fetchVideos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setPendingActionShortCode(null);
    }
  }, [deleteTarget, fetchVideos]);

  const runDelete = useCallback(async (video: VideoRow) => {
    setDeleteTarget(video);
  }, []);

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
        pendingHref,
        navigate,
        prefetchRoute,
        onRetry: runRetry,
        onCancel: runCancel,
        onDelete: runDelete,
        onVisibilityChange: handleVisibilityChange,
      }),
    [
      pollDetails,
      pendingActionShortCode,
      pendingHref,
      navigate,
      prefetchRoute,
      runRetry,
      runCancel,
      runDelete,
      handleVisibilityChange,
    ],
  );

  useEffect(() => {
    if (!hasRestoredState) return;
    fetchVideos();
  }, [fetchVideos, hasRestoredState]);

  // Poll pending videos every 5s; refresh table when status transitions to terminal
  useEffect(() => {
    if (!hasRestoredState) return;

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
  }, [videos, fetchVideos, hasRestoredState]);

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
            ) : loading ? (
              <VideoTableSkeletonRows rows={Math.min(Math.max(pagination.pageSize, 4), 8)} />
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

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle>删除这条视频？</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `视频「${deleteTarget.title}」删除后会从内容列表中移除，此操作不可撤销。`
                : "删除后会从内容列表中移除，此操作不可撤销。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={Boolean(pendingActionShortCode)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={!deleteTarget || Boolean(pendingActionShortCode)}
            >
              {pendingActionShortCode ? <Loader2 className="size-4 animate-spin" /> : null}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
