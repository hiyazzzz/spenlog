export default function DashboardLoading() {
  const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
  )

  return (
    <div className="space-y-5">
      {/* Header skeleton */}
      <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-32 mb-5" />
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
          <div><Skeleton className="h-3 w-20 mb-2" /><Skeleton className="h-6 w-28" /></div>
          <div><Skeleton className="h-3 w-20 mb-2" /><Skeleton className="h-6 w-24" /></div>
        </div>
      </div>
      {/* AI input skeleton */}
      <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100">
        <Skeleton className="h-4 w-20 mb-3" />
        <Skeleton className="h-16 w-full" />
      </div>
      {/* Category skeleton */}
      <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
        <Skeleton className="h-4 w-32 mb-4" />
        {[1,2,3].map(i => (
          <div key={i} className="mb-4">
            <div className="flex justify-between mb-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      {/* Recent skeleton */}
      <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
        <Skeleton className="h-4 w-24 mb-4" />
        {[1,2,3].map(i => (
          <div key={i} className="flex justify-between py-3 border-b border-gray-50 last:border-0">
            <div><Skeleton className="h-4 w-28 mb-1" /><Skeleton className="h-3 w-36" /></div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
