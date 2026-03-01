import { Separator } from "@/components/ui/separator"

export default function DashboardPage() {
  return (
    <div className="flex flex-col p-4 w-full h-full gap-4">
      <p className="text-2xl font-bold ml-4 mt-2">频道信息中心</p>

      <div className="flex flex-nowrap gap-4 mt-2 overflow-x-auto">
        <div className="shrink-0 basis-1/3 min-w-72 max-w-100 px-2">
          <div className="w-full h-full border rounded-xl p-5">
            <div
              className="border rounded-xl min-h-125 flex flex-col justify-center items-center gap-2 bg-transparent">
              <p className="text-sm text-muted-foreground">想查看你近期视频的指标？</p>
              <p className="text-sm text-muted-foreground">
                上传并发布一个视频，即可开始体验。
              </p>
            </div>
          </div>
        </div>

        <div className="shrink-0 basis-1/3 min-w-72 max-w-100 px-2">
          <div className="h-1/2 flex flex-col gap-2 p-4 border rounded-xl">
            <div className="space-y-2">
              <p className="font-bold text-lg">频道分析</p>
              <p>当前订阅人数</p>
              <p className="text-2xl font-bold">0</p>
            </div>
            <Separator/>
            <div className="space-y-2">
              <p className="font-bold">摘要</p>
              <p className="text-muted-foreground">过去28天</p>
              <div className="flex justify-between">
                <p>观看次数</p>
                <p>0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}