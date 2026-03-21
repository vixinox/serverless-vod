"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import type {
  ListUserPlaylistsResult,
  PlaylistItemRow,
  PlaylistListRow,
  PlaylistVideoOption,
} from "@/lib/server/playlists";
import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type PlaylistRow = PlaylistListRow;
type VideoOption = PlaylistVideoOption;

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString();
}

function createColumns(options: {
  pendingPlaylistId: string | null;
  onEdit: (playlist: PlaylistRow) => void;
  onDelete: (playlist: PlaylistRow) => Promise<void>;
  onManage: (playlist: PlaylistRow) => Promise<void>;
}): ColumnDef<PlaylistRow>[] {
  const { pendingPlaylistId, onEdit, onDelete, onManage } = options;

  return [
    {
      accessorKey: "title",
      header: "播放列表",
      cell: ({ row }) => {
        const playlist = row.original;
        return (
          <div className="min-w-72 py-1">
            <div className="font-medium">{playlist.title}</div>
            {playlist.description ? (
              <p className="mt-1 max-w-140 truncate text-xs text-muted-foreground">{playlist.description}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">暂无描述</p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "isPublic",
      header: "可见性",
      cell: ({ row }) =>
        row.original.isPublic ? (
          <Badge variant="secondary" className="rounded-sm border-emerald-200 bg-emerald-50 text-emerald-700">
            公开
          </Badge>
        ) : (
          <Badge variant="secondary" className="rounded-sm border-zinc-200 bg-zinc-50 text-zinc-600">
            私有
          </Badge>
        ),
    },
    {
      id: "itemsCount",
      header: "视频数",
      cell: ({ row }) => row.original._count.items,
    },
    {
      accessorKey: "updatedAt",
      header: "更新时间",
      cell: ({ row }) => formatDate(row.original.updatedAt),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const playlist = row.original;
        const isPending = pendingPlaylistId === playlist.id;

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
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  onEdit(playlist);
                }}
              >
                <Pencil className="size-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  void onManage(playlist);
                }}
              >
                管理内容
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isPending}
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  void onDelete(playlist);
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

export const PlaylistTable = () => {
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [pendingPlaylistId, setPendingPlaylistId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistRow | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formVisibility, setFormVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [savingForm, setSavingForm] = useState(false);

  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [videoOptions, setVideoOptions] = useState<VideoOption[]>([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [targetPlaylistId, setTargetPlaylistId] = useState("");
  const [targetVideoShortCode, setTargetVideoShortCode] = useState("");
  const [videoSearchTerm, setVideoSearchTerm] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);

  const [manageOpen, setManageOpen] = useState(false);
  const [managePlaylist, setManagePlaylist] = useState<PlaylistRow | null>(null);
  const [manageItems, setManageItems] = useState<PlaylistItemRow[]>([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  const reqIdRef = useRef(0);
  const pageCount = Math.ceil(totalCount / pagination.pageSize) || 1;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    const reqId = ++reqIdRef.current;

    try {
      const searchParams = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        pageSize: String(pagination.pageSize),
      });
      if (debouncedTerm) {
        searchParams.set("searchTerm", debouncedTerm);
      }

      const result = await apiRequest<ListUserPlaylistsResult>(
        `/api/studio/playlists?${searchParams.toString()}`
      );

      if (reqId === reqIdRef.current) {
        setPlaylists(result.playlists);
        setTotalCount(result.totalCount);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取播放列表失败");
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, debouncedTerm]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const openCreateDialog = useCallback(() => {
    setEditingPlaylist(null);
    setFormTitle("");
    setFormDescription("");
    setFormVisibility("PUBLIC");
    setEditOpen(true);
  }, []);

  const openEditDialog = useCallback((playlist: PlaylistRow) => {
    setEditingPlaylist(playlist);
    setFormTitle(playlist.title);
    setFormDescription(playlist.description ?? "");
    setFormVisibility(playlist.isPublic ? "PUBLIC" : "PRIVATE");
    setEditOpen(true);
  }, []);

  const submitPlaylist = useCallback(async () => {
    const title = formTitle.trim();
    if (!title) {
      toast.error("请输入播放列表标题");
      return;
    }

    setSavingForm(true);
    try {
      if (editingPlaylist) {
        await apiRequest(`/api/studio/playlists/${editingPlaylist.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description: formDescription.trim() || undefined,
            isPublic: formVisibility === "PUBLIC",
          }),
        });
        toast.success("播放列表已更新");
      } else {
        await apiRequest("/api/studio/playlists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description: formDescription.trim() || undefined,
            isPublic: formVisibility === "PUBLIC",
          }),
        });
        toast.success("播放列表已创建");
      }

      setEditOpen(false);
      await fetchPlaylists();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存播放列表失败");
    } finally {
      setSavingForm(false);
    }
  }, [editingPlaylist, fetchPlaylists, formDescription, formTitle, formVisibility]);

  const runDelete = useCallback(
    async (playlist: PlaylistRow) => {
      const confirmed = window.confirm(`确定删除播放列表「${playlist.title}」吗？`);
      if (!confirmed) return;

      setPendingPlaylistId(playlist.id);
      try {
        await apiRequest(`/api/studio/playlists/${playlist.id}`, {
          method: "DELETE",
        });
        toast.success("播放列表已删除");
        await fetchPlaylists();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除播放列表失败");
      } finally {
        setPendingPlaylistId(null);
      }
    },
    [fetchPlaylists],
  );

  const fetchVideoOptions = useCallback(async () => {
    setVideoLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (videoSearchTerm.trim()) {
        searchParams.set("searchTerm", videoSearchTerm.trim());
      }
      const suffix = searchParams.toString();
      const videos = await apiRequest<VideoOption[]>(
        `/api/studio/videos/for-playlist${suffix ? `?${suffix}` : ""}`
      );
      setVideoOptions(videos);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取视频列表失败");
    } finally {
      setVideoLoading(false);
    }
  }, [videoSearchTerm]);

  useEffect(() => {
    if (!addVideoOpen) return;
    fetchVideoOptions();
  }, [addVideoOpen, fetchVideoOptions]);

  const openAddVideoDialog = useCallback(() => {
    setTargetPlaylistId(playlists[0]?.id ?? "");
    setTargetVideoShortCode("");
    setVideoSearchTerm("");
    setAddVideoOpen(true);
  }, [playlists]);

  const submitAddVideo = useCallback(async () => {
    if (!targetPlaylistId) {
      toast.error("请选择播放列表");
      return;
    }
    if (!targetVideoShortCode) {
      toast.error("请选择视频");
      return;
    }

    setAddingVideo(true);
    try {
      await apiRequest(`/api/studio/playlists/${targetPlaylistId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoShortCode: targetVideoShortCode,
        }),
      });
      toast.success("已添加到播放列表");
      setAddVideoOpen(false);
      await fetchPlaylists();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加视频失败");
    } finally {
      setAddingVideo(false);
    }
  }, [fetchPlaylists, targetPlaylistId, targetVideoShortCode]);

  const openManageDialog = useCallback(async (playlist: PlaylistRow) => {
    setManagePlaylist(playlist);
    setManageOpen(true);
    setManageLoading(true);
    setManageItems([]);

    try {
      const items = await apiRequest<PlaylistItemRow[]>(
        `/api/studio/playlists/${playlist.id}/items`
      );
      setManageItems(items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取播放列表内容失败");
    } finally {
      setManageLoading(false);
    }
  }, []);

  const runRemoveVideo = useCallback(async () => {
    if (!managePlaylist || !removingItemId) return;

    try {
      await apiRequest(
        `/api/studio/playlists/${managePlaylist.id}/items/${removingItemId}`,
        {
          method: "DELETE",
        },
      );
      const items = await apiRequest<PlaylistItemRow[]>(
        `/api/studio/playlists/${managePlaylist.id}/items`,
      );
      setManageItems(items);
      await fetchPlaylists();
      toast.success("已从播放列表移除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除失败");
    } finally {
      setRemovingItemId(null);
    }
  }, [fetchPlaylists, managePlaylist, removingItemId]);

  useEffect(() => {
    if (!removingItemId) return;
    void runRemoveVideo();
  }, [removingItemId, runRemoveVideo]);

  const columns = useMemo(
    () =>
      createColumns({
        pendingPlaylistId,
        onEdit: openEditDialog,
        onDelete: runDelete,
        onManage: openManageDialog,
      }),
    [pendingPlaylistId, openEditDialog, runDelete, openManageDialog],
  );

  const table = useReactTable({
    data: playlists,
    columns,
    pageCount,
    manualPagination: true,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col pb-6">
      <div className="flex items-center justify-between gap-2 rounded-sm border border-border/80 bg-background px-3 py-2">
        <div className="relative flex flex-1 items-center gap-2">
          {loading && (
            <div className="absolute -top-2 left-0 h-0.5 w-full overflow-hidden">
              <div className="h-full animate-loading-bar bg-foreground/70" />
            </div>
          )}
          <Button className="rounded-full" variant="outline" size="icon-sm" onClick={() => fetchPlaylists()} disabled={loading}>
            <RotateCw className="size-4" strokeWidth={1.5} />
          </Button>
          <Input
            placeholder="搜索播放列表"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-8 max-w-sm rounded-sm border-border/80 bg-background"
          />
          <Button variant="outline" size="sm" className="rounded-sm" onClick={openCreateDialog}>
            <Plus className="size-4" /> 新建播放列表
          </Button>
          <Button variant="outline" size="sm" className="rounded-sm" onClick={openAddVideoDialog}>
            <Plus className="size-4" /> 添加视频
          </Button>
        </div>
      </div>

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
                <TableRow key={row.id} className="group border-b border-border/70 hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="h-16 px-2.5 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {loading ? "加载中..." : "暂无播放列表"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border/80 px-1 pt-3">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex ml-4">共 {totalCount} 条</div>
        <div className="flex w-full items-center gap-6 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="playlist-rows-per-page" className="text-sm font-medium whitespace-nowrap">
              每页行数
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" className="w-20 rounded-sm" id="playlist-rows-per-page">
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle>{editingPlaylist ? "编辑播放列表" : "新建播放列表"}</DialogTitle>
            <DialogDescription>设置播放列表基础信息。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="playlist-title">标题</Label>
              <Input
                id="playlist-title"
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
                placeholder="例如：我的精选合集"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="playlist-description">描述</Label>
              <textarea
                id="playlist-description"
                value={formDescription}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setFormDescription(event.target.value)}
                placeholder="可选"
                className="min-h-24 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <div className="space-y-2">
              <Label>可见性</Label>
              <Select value={formVisibility} onValueChange={(value: "PUBLIC" | "PRIVATE") => setFormVisibility(value)}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">公开</SelectItem>
                  <SelectItem value="PRIVATE">私有</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingForm}>取消</Button>
            <Button onClick={() => submitPlaylist()} disabled={savingForm}>
              {savingForm ? <Loader2 className="size-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addVideoOpen} onOpenChange={setAddVideoOpen}>
        <DialogContent className="max-w-lg rounded-sm">
          <DialogHeader>
            <DialogTitle>添加视频到播放列表</DialogTitle>
            <DialogDescription>选择目标播放列表和视频。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>目标播放列表</Label>
              <Select value={targetPlaylistId} onValueChange={setTargetPlaylistId}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="选择播放列表" />
                </SelectTrigger>
                <SelectContent>
                  {playlists.map((playlist) => (
                    <SelectItem key={playlist.id} value={playlist.id}>
                      {playlist.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>搜索视频</Label>
              <div className="flex gap-2">
                <Input
                  value={videoSearchTerm}
                  onChange={(event) => setVideoSearchTerm(event.target.value)}
                  placeholder="输入视频标题"
                />
                <Button variant="outline" onClick={() => fetchVideoOptions()} disabled={videoLoading}>
                  {videoLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                  查询
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>选择视频</Label>
              <Select value={targetVideoShortCode} onValueChange={setTargetVideoShortCode}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="选择视频" />
                </SelectTrigger>
                <SelectContent>
                  {videoOptions.map((video) => (
                    <SelectItem key={video.id} value={video.shortCode}>
                      {video.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddVideoOpen(false)} disabled={addingVideo}>取消</Button>
            <Button onClick={() => submitAddVideo()} disabled={addingVideo}>
              {addingVideo ? <Loader2 className="size-4 animate-spin" /> : null}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-2xl rounded-sm">
          <DialogHeader>
            <DialogTitle>管理播放列表内容</DialogTitle>
            <DialogDescription>
              {managePlaylist ? `当前列表：${managePlaylist.title}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60svh] space-y-3 overflow-y-auto">
            {manageLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="ml-2">加载中...</span>
              </div>
            ) : null}

            {!manageLoading && manageItems.length === 0 ? (
              <div className="rounded-sm border border-dashed p-8 text-center text-sm text-muted-foreground">
                该播放列表暂无视频
              </div>
            ) : null}

            {!manageLoading
              ? manageItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-sm border p-2">
                    <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-sm border bg-muted">
                      <SmartImage src={item.video.thumbnail} alt={item.video.title} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.video.title}</p>
                      <p className="text-xs text-muted-foreground">#{item.position + 1}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-sm"
                      disabled={removingItemId === item.id}
                      onClick={() => setRemovingItemId(item.id)}
                    >
                      {removingItemId === item.id ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
                      移除
                    </Button>
                  </div>
                ))
              : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
