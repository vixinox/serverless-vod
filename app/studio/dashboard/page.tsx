import Link from "next/link";
import { getDashboardSummary } from "@/actions/studio/get-dashboard-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function formatViews(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1).replace(".0", "")}万`;
  }

  return `${value}`;
}

function formatDate(value: Date | null) {
  if (!value) {
    return "未发布";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

export default async function DashboardPage() {
  const dashboard = await getDashboardSummary();

  return (
    <div className="flex flex-col p-4 w-full h-full gap-4">
      <div className="ml-4 mt-2 space-y-1">
        <p className="text-2xl font-bold">频道信息中心</p>
        <p className="text-sm text-muted-foreground">
          {dashboard.hasChannel && dashboard.channel
            ? `当前频道：${dashboard.channel.name}`
            : "当前账号还没有频道，上传视频后会自动创建频道"}
        </p>
      </div>

      <div className="grid gap-4 px-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="min-h-72">
          <CardHeader>
            <CardTitle>概览</CardTitle>
            <CardDescription>把答辩时最容易被问的数据先接上真实值。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.hasChannel && dashboard.channel ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">当前订阅人数</p>
                    <p className="mt-2 text-3xl font-semibold">{dashboard.summary.subscribersCount}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">近 7 天观看次数</p>
                    <p className="mt-2 text-3xl font-semibold">{formatViews(dashboard.summary.viewsLast7Days)}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">频道视频数</p>
                    <p className="mt-2 text-3xl font-semibold">{dashboard.summary.totalVideos}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <p className="font-semibold">最近发布</p>
                    <p className="text-sm text-muted-foreground">
                      直接从视频表读取，避免 Dashboard 继续展示硬编码 0。
                    </p>
                  </div>

                  {dashboard.recentVideos.length > 0 ? (
                    <div className="space-y-3">
                      {dashboard.recentVideos.map((video) => (
                        <div
                          key={video.id}
                          className="flex items-center justify-between rounded-xl border px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{video.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {video.visibility} / {video.processingStatus} / {formatDate(video.publishedAt ?? video.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatViews(video.views)} 次观看</p>
                            <Link
                              href={`/watch/${video.shortCode}`}
                              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                            >
                              查看视频
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                      还没有视频数据，先上传一个视频就能看到这里的真实内容。
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="border rounded-xl min-h-52 flex flex-col justify-center items-center gap-2 bg-transparent">
                <p className="text-sm text-muted-foreground">想查看你近期视频的指标？</p>
                <p className="text-sm text-muted-foreground">
                  上传并发布一个视频，即可开始体验。
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-72">
          <CardHeader>
            <CardTitle>答辩说明</CardTitle>
            <CardDescription>这块现在对应的都是真实数据库字段或聚合表。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>订阅人数：`Channel.subscribersCount`</p>
            <p>近 7 天观看次数：`VideoDailyStat.views` 按频道聚合</p>
            <p>最近发布视频：`Video` 表按发布时间/创建时间倒序</p>
            <p>更完整的趋势数据可以去 Studio 的“统计”页面查看。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
