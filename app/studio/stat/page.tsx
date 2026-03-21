import Link from "next/link";
import { getChannelStats, getVideoStats } from "@/lib/server/stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatCount(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1).replace(".0", "")}万`;
  }

  return `${value}`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatHours(seconds: number) {
  return `${(seconds / 3600).toFixed(1)} 小时`;
}

export default async function StatPage() {
  const [channelStats, videoStats] = await Promise.all([
    getChannelStats(),
    getVideoStats(),
  ]);

  return (
    <div className="flex-1 p-4 space-y-4">
      <div className="px-2">
        <h1 className="text-2xl font-bold">统计概览</h1>
        <p className="text-sm text-muted-foreground">
          先用现有组件把后端统计查通，图表和更完整的可视化可以后续再补。
        </p>
      </div>

      {!channelStats.hasChannel || !channelStats.channel ? (
        <Card>
          <CardHeader>
            <CardTitle>暂无频道</CardTitle>
            <CardDescription>上传视频后会自动创建频道，统计数据也会开始累计。</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>近 30 天观看次数</CardDescription>
                <CardTitle className="text-3xl">{formatCount(channelStats.totals.views)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>近 30 天观看时长</CardDescription>
                <CardTitle className="text-3xl">{formatHours(channelStats.totals.watchTimeSeconds)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>近 30 天净增订阅</CardDescription>
                <CardTitle className="text-3xl">{channelStats.totals.subscribersNet}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>近 30 天发布视频</CardDescription>
                <CardTitle className="text-3xl">{channelStats.totals.videosPublished}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>频道日统计</CardTitle>
                <CardDescription>
                  数据来自 `ChannelDailyStat`，先用表格替代图表，方便答辩时展示真实聚合结果。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>观看次数</TableHead>
                      <TableHead>观看时长</TableHead>
                      <TableHead>订阅净增</TableHead>
                      <TableHead>发布数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channelStats.daily.slice(-10).reverse().map((item) => (
                      <TableRow key={item.date.toISOString()}>
                        <TableCell>{formatDate(item.date)}</TableCell>
                        <TableCell>{formatCount(item.views)}</TableCell>
                        <TableCell>{formatHours(item.watchTimeSeconds)}</TableCell>
                        <TableCell>{item.subscribersGained - item.subscribersLost}</TableCell>
                        <TableCell>{item.videosPublished}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>页面状态</CardTitle>
                <CardDescription>本次先完成后端设计和可复用布局，不额外做新的图表 UI。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>已接通 `ChannelDailyStat` 近 30 天查询</p>
                <p>已接通 `VideoDailyStat` 的单视频聚合</p>
                <p>当前页面使用表格展示，后续可直接在此基础上接 ECharts</p>
                <p>
                  如果聚合表暂时为空，可以先跑现有 rollup/seed 脚本，再回到这个页面查看趋势。
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>视频表现</CardTitle>
              <CardDescription>
                最近 30 天按视频聚合，方便答辩时快速展示哪个视频带来了播放和互动。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>视频</TableHead>
                    <TableHead>累计观看</TableHead>
                    <TableHead>近 30 天观看</TableHead>
                    <TableHead>独立观众</TableHead>
                    <TableHead>新增点赞</TableHead>
                    <TableHead>新增评论</TableHead>
                    <TableHead>跳转</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videoStats.videos.length > 0 ? videoStats.videos.map((video) => (
                    <TableRow key={video.id}>
                      <TableCell className="max-w-80 truncate">{video.title}</TableCell>
                      <TableCell>{formatCount(video.views)}</TableCell>
                      <TableCell>{formatCount(video.viewsLastDays)}</TableCell>
                      <TableCell>{video.uniqueViewersLastDays}</TableCell>
                      <TableCell>{video.likesGainedLastDays}</TableCell>
                      <TableCell>{video.commentsGainedLastDays}</TableCell>
                      <TableCell>
                        <Link
                          href={`/watch/${video.shortCode}`}
                          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                        >
                          查看
                        </Link>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        还没有视频统计数据。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
