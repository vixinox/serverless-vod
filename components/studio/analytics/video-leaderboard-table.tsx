"use client";

import type { KeyboardEvent } from "react";
import Link from "next/link";
import { useStudioTransition } from "@/components/studio/basic/studio-transition";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StatPageData } from "@/lib/server/stats";
import { formatCompactNumber, formatHoursLabel, formatVideoTypeLabel } from "@/components/studio/analytics/utils";

type VideoLeaderboardRow = StatPageData["videoLeaderboard30d"][number];

export function VideoLeaderboardTable({
  rows,
}: {
  rows: VideoLeaderboardRow[];
}) {
  const { navigate } = useStudioTransition();

  const handleRowNavigation = (shortCode: string) => {
    navigate(`/studio/stat/${shortCode}`);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, shortCode: string) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    navigate(`/studio/stat/${shortCode}`);
  };

  return (
    <Table className="min-w-[920px]">
      <TableHeader>
        <TableRow>
          <TableHead>视频</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>累计观看</TableHead>
          <TableHead>30 天观看</TableHead>
          <TableHead>独立观众</TableHead>
          <TableHead>观看时长</TableHead>
          <TableHead>新增点赞</TableHead>
          <TableHead>新增评论</TableHead>
          <TableHead>跳转</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length > 0 ? (
          rows.map((video) => (
            <TableRow
              key={video.id}
              tabIndex={0}
              role="link"
              onClick={() => handleRowNavigation(video.shortCode)}
              onKeyDown={(event) => handleRowKeyDown(event, video.shortCode)}
              className="cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <TableCell className="max-w-72 truncate font-medium">
                <div className="flex flex-col gap-1">
                  <span className="truncate">{video.title}</span>
                  <span className="text-xs text-muted-foreground">点击整行查看单视频分析</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{formatVideoTypeLabel(video.type)}</Badge>
              </TableCell>
              <TableCell>{formatCompactNumber(video.viewsTotal)}</TableCell>
              <TableCell>{formatCompactNumber(video.viewsLastDays)}</TableCell>
              <TableCell>{video.uniqueViewersLastDays.toLocaleString("zh-CN")}</TableCell>
              <TableCell>{formatHoursLabel(video.watchTimeHoursLastDays)}</TableCell>
              <TableCell>{video.likesGainedLastDays.toLocaleString("zh-CN")}</TableCell>
              <TableCell>{video.commentsGainedLastDays.toLocaleString("zh-CN")}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-sm font-medium underline-offset-4 hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRowNavigation(video.shortCode);
                    }}
                  >
                    分析
                  </button>
                  <Link
                    href={`/watch/${video.shortCode}`}
                    className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    播放页
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
              近 30 天还没有视频聚合数据，跑完聚合任务后这里会显示视频排行榜。
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
