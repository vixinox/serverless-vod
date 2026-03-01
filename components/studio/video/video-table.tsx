"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChartColumn, MessageSquareText, Pencil, RotateCw, ThumbsDown, ThumbsUp, TvMinimalPlay } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Video } from "@prisma/client";
import { listUserVideos } from "@/actions/video/get-user-videos";
import { SmartImage } from "@/components/smart-image";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import Link from "next/link";

const controlButtons = [
  {
    title: "详细信息",
    icon: Pencil,
    url: "/studio/contents/video/",
  },
  {
    title: "数据分析",
    icon: ChartColumn,
    url: "/studio/analytics/",
  },
  {
    title: "评论",
    icon: MessageSquareText,
    url: "/studio/comments/",
  },
  {
    title: "观看",
    icon: TvMinimalPlay,
    url: "/watch/",
  },
];

const visibilityMap = {
  PUBLIC: "公开",
  PRIVATE: "私享",
  UNLISTED: "不公开",
  DRAFT: "草稿",
};

function calcLikeRatio(likesCount: number, dislikesCount: number) {
  const ratio = (likesCount / Math.max(likesCount + dislikesCount, 1)) * 100;
  return ratio.toFixed(1);
}

export const VideoTable = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [debouncedTerm, setDebouncedTerm] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const reqIdRef = useRef(0);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    const myReqId = ++reqIdRef.current;

    try {
      const { videos, totalCount } = await listUserVideos({
        page,
        pageSize,
        searchTerm: debouncedTerm,
      });

      if (myReqId === reqIdRef.current) {
        setVideos(videos);
        setTotalCount(totalCount);
      }
    } finally {
      if (myReqId === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, pageSize, debouncedTerm]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleRefresh = useCallback(() => {
    fetchVideos();
  }, [fetchVideos]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(totalPages, p)));
  };

  const renderSmartPageLinks = () => {
    const items = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              isActive={i === page}
              onClick={(e) => {
                e.preventDefault();
                goToPage(i);
              }}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
      return items;
    }

    items.push(
      <PaginationItem key={1}>
        <PaginationLink
          href="#"
          isActive={page === 1}
          onClick={(e) => {
            e.preventDefault();
            goToPage(1);
          }}
        >
          1
        </PaginationLink>
      </PaginationItem>
    );

    if (page > 4) {
      items.push(<PaginationEllipsis key="start-ellipsis"/>);
    }

    const start = Math.max(2, page - 2);
    const end = Math.min(totalPages - 1, page + 2);
    for (let i = start; i <= end; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            href="#"
            isActive={i === page}
            onClick={(e) => {
              e.preventDefault();
              goToPage(i);
            }}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (page < totalPages - 3) {
      items.push(<PaginationEllipsis key="end-ellipsis"/>);
    }

    items.push(
      <PaginationItem key={totalPages}>
        <PaginationLink
          href="#"
          isActive={page === totalPages}
          onClick={(e) => {
            e.preventDefault();
            goToPage(totalPages);
          }}
        >
          {totalPages}
        </PaginationLink>
      </PaginationItem>
    );

    return items;
  };

  return (
    <div className="relative overflow-y-auto w-full max-h-screen">
      <div className="flex items-center w-full h-12 sticky top-0 z-20 border-y bg-studio-background">
        {loading && (
          <div className="absolute top-0 left-0 w-full h-0.5 overflow-hidden">
            <div className="h-full bg-red-500 animate-loading-bar"/>
          </div>
        )}
        <RotateCw
          className="w-6 h-6 flex-none ml-6 mr-5 cursor-pointer"
          strokeWidth={1}
          onClick={handleRefresh}
        />
        <input
          id="filter-input"
          type="text"
          placeholder="过滤条件"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="flex-1 p-2 outline-none caret-blue-500 placeholder:text-sm"
        />
      </div>

      <Table className="border-b">
        <TableHeader className="h-12 sticky top-12 z-10 bg-studio-background">
          <TableRow>
            <TableHead className="pl-6 w-1/3 text-muted-foreground">视频</TableHead>
            <TableHead className="text-muted-foreground">公开范围</TableHead>
            <TableHead className="text-muted-foreground">分类</TableHead>
            <TableHead className="text-muted-foreground">日期</TableHead>
            <TableHead className="text-muted-foreground">观看次数</TableHead>
            <TableHead className="text-muted-foreground">评论数</TableHead>
            <TableHead className="pr-6 text-muted-foreground">赞踩比</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="h[200vh]">
          {videos.map((video) => {
            const ratio = calcLikeRatio(Number(video.likesCount), Number(video.dislikesCount));
            return (
              <TableRow key={video.shortCode} className="group hover:bg-hover-dark duration-50">
                <TableCell className="pl-6 min-w-md">
                  <div className="flex items-center gap-3">
                    <div className="relative w-32 h-18 shrink-0 rounded-lg border overflow-hidden">
                      <SmartImage
                        src={video.thumbnail}
                        alt={video.title}
                      />
                      {video.duration && (
                        <div
                          className="absolute bottom-1 right-1 text-xs p-1 rounded bg-white dark:bg-black bg-opacity-75 transition">
                          {`${Math.floor(video.duration / 60)}:${Math.floor(video.duration % 60).toString().padStart(2, '0')}`}
                        </div>
                      )}
                    </div>
                    <div className="w-full">
                      <div className="text-sm mt-2.5 ml-1">{video.title}</div>
                      <div className="flex gap-4 mt-1">
                        {controlButtons.map((item) => (
                          <Tooltip key={item.title}>
                            <TooltipTrigger
                              className="cursor-pointer rounded-full p-2 w-10 h-10 bg-transparent hover:bg-primary/15
                              opacity-0 group-hover:opacity-100 transition-opacity duration-100"
                            >
                              <Link
                                href={item.url + video.shortCode}
                                prefetch={false}
                                target={item.url === "/watch/" ? "_blank" : "_self"}
                              >
                                <item.icon
                                  className="size-full"
                                  strokeWidth={1.25}
                                />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              {item.title}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{visibilityMap[video.visibility]}</TableCell>
                <TableCell>
                  {new Date(video.createdAt).toLocaleDateString()}
                  <p className="text-muted-foreground">上传</p>
                </TableCell>
                <TableCell>{video.views.toLocaleString()}</TableCell>
                <TableCell className="pr-6">{video.commentsCount.toLocaleString()}</TableCell>
                <TableCell className="pr-6">
                  <Tooltip>
                    <TooltipTrigger>
                      {ratio}%
                    </TooltipTrigger>
                    <TooltipContent className="rounded-xl flex items-center px-4 gap-3">
                      <ThumbsUp className="size-5"/>
                      <p className="text-lg">{video.likesCount.toLocaleString('en-US')}</p>
                      <ThumbsDown className="size-5 ml-5"/>
                      <p className="text-lg">{video.dislikesCount.toLocaleString('en-US')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    goToPage(page - 1);
                  }}
                />
              </PaginationItem>

              {renderSmartPageLinks()}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    goToPage(page + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};