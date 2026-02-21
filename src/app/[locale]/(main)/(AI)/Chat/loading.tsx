import { Skeleton } from "@/src/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="h-screen w-full bg-white overflow-hidden">
      {/* 顶部导航栏骨架屏 */}
      <div className="w-full h-16 border-b border-gray-200 flex items-center px-4">
        <Skeleton className="h-8 w-40" />
        <div className="ml-auto">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      
      {/* 主内容区域骨架屏 */}
      <div className="flex-1 flex">
        {/* 左侧对话列表骨架屏 */}
        <div className="w-80 border-r border-gray-200 p-4">
          <Skeleton className="h-10 w-full mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
        
        {/* 右侧消息区域骨架屏 */}
        <div className="flex-1 flex flex-col">
          {/* 消息列表骨架屏 */}
          <div className="flex-1 p-4 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
          
          {/* 输入框骨架屏 */}
          <div className="border-t border-gray-200 p-4">
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}