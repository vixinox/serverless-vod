"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api-client";

interface PlaylistRow {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  containsVideo?: boolean;
  _count: {
    items: number;
  };
}

interface CreatePlaylistResponse {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
}

export function SaveToPlaylistDialog({
  open,
  onOpenChange,
  shortCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortCode: string;
}) {
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pendingPlaylistId, setPendingPlaylistId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const fetchPlaylists = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const result = await apiRequest<{ playlists: PlaylistRow[] }>(
          `/api/studio/playlists?page=1&pageSize=100&videoShortCode=${encodeURIComponent(shortCode)}`,
        );

        if (cancelled) {
          return;
        }

        setPlaylists(result.playlists);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "读取播放列表失败";
        setPlaylists([]);
        setLoadError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchPlaylists();

    return () => {
      cancelled = true;
    };
  }, [open, shortCode]);

  const pendingLabel = useMemo(() => {
    if (!pendingPlaylistId) {
      return "";
    }

    return playlists.find((playlist) => playlist.id === pendingPlaylistId)?.title ?? "";
  }, [pendingPlaylistId, playlists]);

  const handleAddToPlaylist = async (playlistId: string) => {
    setPendingPlaylistId(playlistId);

    try {
      await apiRequest(`/api/studio/playlists/${playlistId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoShortCode: shortCode,
        }),
      });

      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                containsVideo: true,
                _count: {
                  items: playlist.containsVideo ? playlist._count.items : playlist._count.items + 1,
                },
              }
            : playlist,
        ),
      );
      toast.success("已添加到播放列表");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加失败");
    } finally {
      setPendingPlaylistId("");
    }
  };

  const handleCreate = async () => {
    const safeTitle = title.trim();

    if (!safeTitle) {
      toast.error("请输入播放列表标题");
      return;
    }

    setIsCreating(true);

    try {
      const created = await apiRequest<CreatePlaylistResponse>("/api/studio/playlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: safeTitle,
          description: description.trim() || undefined,
          isPublic: visibility === "PUBLIC",
        }),
      });

      await apiRequest(`/api/studio/playlists/${created.id}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoShortCode: shortCode,
        }),
      });

      setPlaylists((current) => [
        {
          ...created,
          containsVideo: true,
          _count: {
            items: 1,
          },
        },
        ...current,
      ]);
      setTitle("");
      setDescription("");
      setVisibility("PRIVATE");
      toast.success("新播放列表已创建，并已加入当前视频");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建播放列表失败");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-3xl border-border/70 p-0 shadow-xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>添加到播放列表</DialogTitle>
          <DialogDescription>
            这里管理的是你的自定义播放列表，系统列表会单独显示在播放器操作区。
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-6 py-5">
          <Card className="gap-0 rounded-3xl py-0 shadow-none">
            <CardHeader className="border-b">
              <CardTitle className="text-base">新建后立即加入</CardTitle>
              <CardDescription>新建一个列表，并立刻把当前视频放进去。</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="watch-playlist-title">播放列表标题</FieldLabel>
                  <FieldContent>
                    <Input
                      id="watch-playlist-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      maxLength={120}
                      placeholder="例如：答辩演示 / 晚点继续看"
                    />
                    <FieldDescription>创建完成后，当前视频会自动加入这个列表。</FieldDescription>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="watch-playlist-description">描述</FieldLabel>
                  <FieldContent>
                    <Input
                      id="watch-playlist-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      maxLength={1000}
                      placeholder="可选，补充这个列表的用途"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>可见范围</FieldLabel>
                  <FieldContent>
                    <Select value={visibility} onValueChange={(value) => setVisibility(value as "PUBLIC" | "PRIVATE")}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择可见范围" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="PRIVATE">仅自己可见</SelectItem>
                          <SelectItem value="PUBLIC">公开</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end border-t py-4">
              <Button className="rounded-full" disabled={isCreating} onClick={handleCreate}>
                {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus />}
                创建并加入
              </Button>
            </CardFooter>
          </Card>

          <Card className="gap-0 rounded-3xl py-0 shadow-none">
            <CardHeader className="border-b">
              <CardTitle className="text-base">现有播放列表</CardTitle>
              <CardDescription>从你已有的列表里选择一个，当前视频会直接加入。</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在读取播放列表...
                </div>
              ) : loadError ? (
                <div className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                  {loadError}
                </div>
              ) : playlists.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {playlists.map((playlist) => (
                    <Card key={playlist.id} className="gap-0 rounded-2xl py-0 shadow-none">
                      <CardHeader className="gap-3 border-b">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{playlist.title}</CardTitle>
                          <Badge variant={playlist.isPublic ? "secondary" : "outline"}>
                            {playlist.isPublic ? (
                              <>
                                <Users />
                                公开
                              </>
                            ) : (
                              <>
                                <Lock />
                                私密
                              </>
                            )}
                          </Badge>
                          <Badge variant="outline">{playlist._count.items} 个视频</Badge>
                        </div>
                        <CardDescription>
                          {playlist.description || "暂无描述"}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="justify-between py-4">
                        <p className="text-sm text-muted-foreground">
                          {playlist.containsVideo ? "当前视频已在这个列表中" : "点击即可加入到这个列表"}
                        </p>
                        <Button
                          className="rounded-full"
                          disabled={Boolean(playlist.containsVideo) || pendingPlaylistId === playlist.id}
                          onClick={() => handleAddToPlaylist(playlist.id)}
                          variant={playlist.containsVideo ? "secondary" : "default"}
                        >
                          {pendingPlaylistId === playlist.id ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              添加中
                            </>
                          ) : playlist.containsVideo ? (
                            "已添加"
                          ) : (
                            "添加"
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                  还没有自定义播放列表，先在上面创建一个吧。
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <p className="flex-1 text-sm text-muted-foreground">
            {pendingLabel ? `正在处理：${pendingLabel}` : "收藏夹与稍后再看会作为系统列表单独维护。"}
          </p>
          <Button className="rounded-full" onClick={() => onOpenChange(false)} variant="outline">
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
