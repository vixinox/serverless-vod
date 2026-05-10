"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useStudioTransition } from "@/components/studio/basic/studio-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StatPageData } from "@/lib/server/stats";
import {
  formatCompactNumber,
  formatDecimalPercent,
  formatDurationSeconds,
} from "@/components/studio/analytics/utils";

type VideoLeaderboardRow = StatPageData["videoLeaderboard30d"][number];
const PAGE_SIZE = 10;

function getRankTone(index: number) {
  if (index === 0) return "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (index === 1) return "border-slate-300/60 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  if (index === 2) return "border-orange-300/60 bg-orange-500/10 text-orange-700 dark:text-orange-300";
  return "border-border/70 bg-muted/50 text-muted-foreground";
}

export function VideoLeaderboardTable({
  rows,
}: {
  rows: VideoLeaderboardRow[];
}) {
  const { navigate } = useStudioTransition();
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [currentPage, rows]);
  const pageStartRank = (currentPage - 1) * PAGE_SIZE;

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
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Table className="min-w-[780px]">
          <TableHeader>
            <TableRow>
              <TableHead>排名</TableHead>
              <TableHead>视频</TableHead>
              <TableHead>30 天观看</TableHead>
              <TableHead>贡献</TableHead>
              <TableHead>平均观看</TableHead>
              <TableHead>互动率</TableHead>
              <TableHead>标签</TableHead>
              <TableHead>跳转</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              pagedRows.map((video, index) => {
                const rank = pageStartRank + index + 1;

                return (
                  <TableRow
                    key={video.id}
                    tabIndex={0}
                    role="link"
                    onClick={() => handleRowNavigation(video.shortCode)}
                    onKeyDown={(event) => handleRowKeyDown(event, video.shortCode)}
                    className="cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <TableCell>
                      <span className={`inline-flex min-w-10 items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getRankTone(rank - 1)}`}>
                        #{rank}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-72 truncate font-medium">
                      <div className="flex flex-col gap-1">
                        <span className="truncate">{video.title}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>跟踪 {video.trackedDays} 天</span>
                          <span>累计 {formatCompactNumber(video.viewsTotal)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{formatCompactNumber(video.viewsLastDays)}</TableCell>
                    <TableCell>{formatDecimalPercent(video.contributionPercent)}</TableCell>
                    <TableCell>{formatDurationSeconds(video.averageViewSeconds)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-full px-2.5 py-1">
                        {formatDecimalPercent(video.engagementRate)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full px-2.5 py-1">
                        {video.label}
                      </Badge>
                    </TableCell>
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
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  近 30 天还没有视频聚合数据，跑完聚合任务后这里会显示视频排行榜。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border/70 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{`第 ${currentPage} / ${totalPages} 页 · 共 ${formatCompactNumber(rows.length)} 条内容`}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              上一页
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              下一页
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
