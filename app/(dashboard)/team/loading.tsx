export default function TeamLoading() {
  return (
    <div className="flex h-full -mx-6 -my-6 animate-pulse">
      {/* Sidebar skeleton */}
      <aside className="w-56 border-r border-gray-200 bg-gray-50 flex-shrink-0 pt-6 pb-4 px-4 space-y-3">
        <div className="h-3 w-16 bg-gray-200 rounded mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 bg-gray-200 rounded-lg" />
        ))}
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 bg-gray-200 rounded" />
          <div className="h-9 w-28 bg-gray-200 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="h-10 w-10 bg-gray-200 rounded-lg" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-100 rounded" />
              <div className="flex gap-1 mt-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-6 w-6 bg-gray-200 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
