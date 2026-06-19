export default function AnalyticsLoading() {
  const Sk = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
  )
  return (
    <div className="pb-20">
      <div className="flex justify-between items-center mb-5">
        <Sk className="h-6 w-16" />
        <div className="flex items-center gap-3">
          <Sk className="h-8 w-8 rounded-full" />
          <Sk className="h-4 w-24" />
          <Sk className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <Sk className="h-24 w-full mb-4" />
      <Sk className="h-44 w-full mb-4" />
      <Sk className="h-32 w-full mb-4" />
    </div>
  )
}
