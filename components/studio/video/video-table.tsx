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
  Clock3,
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
import Link from "next/link";
import { toast } from "sonner";

import { cancelVideoJob } from "@/actions/video/cancel-video-job";
import { deleteVideo } from "@/actions/video/delete-video";
import {
  getVideoJobTimeline,
  type JobTimelineItem,
} from "@/actions/video/get-video-job-timeline";
import {
  getProcessingStatuses,
  type ProcessingStatusItem,
} from "@/actions/video/get-processing-statuses";
import { retryVideoJob } from "@/actions/video/retry-video-job";
import { listUserVideos } from "@/actions/video/get-user-videos";
import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

type VideoRow = Awaited<ReturnType<typeof listUserVideos>>["videos"][number];

const PENDING_STATUSES = new Set(["UPLOADING", "PROCESSING"]);
const POLL_INTERVAL_MS = 5000;

const visibilityMap: Record<string, string> = {
  PUBLIC: "公开",
  PRIVATE: "私享",
  UNLISTED: "不公开",
  DRAFT: "草稿",
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
        <TooltipContent className="max-w-52 break-words ">{error}</TooltipContent>
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

function TimelineDialog({
  open,
  onOpenChange,
  shortCode,
  processingStatus,
  processingError,
  jobs,
  loading,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortCode: string;
  processingStatus: string;
  processingError: string | null;
  jobs: JobTimelineItem[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-sm p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base">任务时间线</DialogTitle>
          <DialogDescription className="">
            shortCode: <span className="font-mono">{shortCode || "—"}</span>
          </DialogDescription>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className="rounded-sm">
              当前视频状态: {processingStatus || "—"}
            </Badge>
            {processingError ? (
              <span className="max-w-[70%] truncate  text-destructive">{processingError}</span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="max-h-[65svh] space-y-3 overflow-y-auto px-5 py-4">
          {loading ? (
            <>
              <Skeleton className="h-20 rounded-sm" />
              <Skeleton className="h-20 rounded-sm" />
              <Skeleton className="h-20 rounded-sm" />
            </>
          ) : null}

          {!loading && error ? (
            <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {!loading && !error && jobs.length === 0 ? (
            <div className="rounded-sm border border-dashed p-8 text-center text-sm text-muted-foreground">
              暂无任务记录
            </div>
          ) : null}

          {!loading && !error
            ? jobs.map((job) => (
                <div key={job.id} className="rounded-sm border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono  text-muted-foreground">{job.id}</p>
                      <p className="mt-1  text-muted-foreground">
                        尝试 {job.attempt}/{job.maxAttempts}
                      </p>
                    </div>
                    <JobStatusBadge status={job.status} />
                  </div>

                  <div className="grid grid-cols-1 gap-2  text-muted-foreground md:grid-cols-3">
                    <p>排队: {formatDateTime(job.queuedAt)}</p>
                    <p>开始: {formatDateTime(job.startedAt)}</p>
                    <p>结束: {formatDateTime(job.finishedAt)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 ">
                    <Badge variant="outline" className="rounded-sm">
                      阶段: {job.pipelineStage ? stageLabels[job.pipelineStage] ?? job.pipelineStage : "—"}
                    </Badge>
                    <Badge variant="outline" className="rounded-sm">
                      总耗时: {formatWallSeconds(job.wallSeconds)}
                    </Badge>
                  </div>
                  {job.lastError ? (
                    <p className="mt-2 break-all rounded-sm border border-destructive/30 bg-destructive/5 p-2  text-destructive">
                      {job.lastError}
                    </p>
                  ) : null}
                </div>
              ))
            : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function createColumns(
  pollDetails: Record<string, ProcessingStatusItem>,
  options: {
    pendingShortCode: string | null;
    onOpenTimeline: (video: VideoRow) => void;
    onRetry: (video: VideoRow) => Promise<void>;
    onCancel: (video: VideoRow) => Promise<void>;
    onDelete: (video: VideoRow) => Promise<void>;
  },
): ColumnDef<VideoRow>[] {
  const { pendingShortCode, onOpenTimeline, onRetry, onCancel, onDelete } = options;

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
          <Badge variant="outline" className="rounded-sm px-1.5 text-muted-foreground">
            {visibilityMap[row.original.visibility] ?? row.original.visibility}
          </Badge>
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
              <DropdownMenuItem asChild>
                <Link href={`/watch/${video.shortCode}`} target="_blank">
                  观看
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  onOpenTimeline(video);
                }}
              >
                <Clock3 className="size-4" />
                任务时间线
              </DropdownMenuItem>
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
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineShortCode, setTimelineShortCode] = useState("");
  const [timelineProcessingStatus, setTimelineProcessingStatus] = useState("");
  const [timelineProcessingError, setTimelineProcessingError] = useState<string | null>(null);
  const [timelineJobs, setTimelineJobs] = useState<JobTimelineItem[]>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  const reqIdRef = useRef(0);
  const timelineReqIdRef = useRef(0);
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
      const result = await listUserVideos({
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        searchTerm: debouncedTerm,
      });
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

  const openTimeline = useCallback(async (video: VideoRow) => {
    setTimelineOpen(true);
    setTimelineShortCode(video.shortCode);
    setTimelineProcessingStatus(video.processingStatus);
    setTimelineProcessingError(video.processingError);
    setTimelineJobs([]);
    setTimelineLoading(true);
    setTimelineError(null);

    const reqId = ++timelineReqIdRef.current;
    try {
      const timeline = await getVideoJobTimeline(video.shortCode, 8);
      if (reqId !== timelineReqIdRef.current) return;
      setTimelineShortCode(timeline.shortCode);
      setTimelineProcessingStatus(timeline.processingStatus);
      setTimelineProcessingError(timeline.processingError);
      setTimelineJobs(timeline.jobs);
    } catch (error) {
      if (reqId !== timelineReqIdRef.current) return;
      setTimelineError(error instanceof Error ? error.message : "读取任务时间线失败");
      setTimelineJobs([]);
    } finally {
      if (reqId === timelineReqIdRef.current) setTimelineLoading(false);
    }
  }, []);

  const runRetry = useCallback(async (video: VideoRow) => {
    setPendingActionShortCode(video.shortCode);
    try {
      await retryVideoJob(video.shortCode);
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
      await cancelVideoJob(video.shortCode);
      toast.success("已取消当前任务");
      await fetchVideos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "取消失败");
    } finally {
      setPendingActionShortCode(null);
    }
  }, [fetchVideos]);

  const runDelete = useCallback(async (video: VideoRow) => {
    const confirmed = window.confirm(`确定删除视频「${video.title}」吗？该操作可在后台恢复。`);
    if (!confirmed) return;

    setPendingActionShortCode(video.shortCode);
    try {
      await deleteVideo(video.shortCode);
      setVideos((prev) => prev.filter((item) => item.shortCode !== video.shortCode));
      setPollDetails((prev) => {
        const { [video.shortCode]: _removed, ...rest } = prev;
        return rest;
      });
      toast.success("视频已移至回收状态");
      await fetchVideos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setPendingActionShortCode(null);
    }
  }, [fetchVideos]);

  const columns = useMemo(
    () =>
      createColumns(pollDetails, {
        pendingShortCode: pendingActionShortCode,
        onOpenTimeline: openTimeline,
        onRetry: runRetry,
        onCancel: runCancel,
        onDelete: runDelete,
      }),
    [pollDetails, pendingActionShortCode, openTimeline, runRetry, runCancel, runDelete],
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
        const statuses = await getProcessingStatuses(pendingCodes);
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
          fetchVideos();
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
            placeholder="过滤条件"
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

      <TimelineDialog
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        shortCode={timelineShortCode}
        processingStatus={timelineProcessingStatus}
        processingError={timelineProcessingError}
        jobs={timelineJobs}
        loading={timelineLoading}
        error={timelineError}
      />
    </div>
  );
};
