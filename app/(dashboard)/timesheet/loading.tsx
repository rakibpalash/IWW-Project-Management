export default function TimesheetLoading() {
  return (
    <div className="flex flex-col h-full bg-gray-50 animate-pulse">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-8 w-28 bg-gray-200 rounded-lg" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
          {/* Stat cards */}
          <div className="flex gap-3 flex-wrap">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 min-w-[140px]">
                <div className="h-9 w-9 bg-gray-200 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                  <div className="h-5 w-12 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            {[130, 130, 130].map((w, i) => (
              <div key={i} style={{ width: w }} className="h-9 bg-gray-200 rounded-lg" />
            ))}
          </div>

          {/* Entry groups */}
          {[1, 2].map((g) => (
            <div key={g} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <div className="h-4 w-16 bg-gray-200 rounded" />
                <div className="h-3 w-24 bg-gray-200 rounded" />
              </div>
              <div className="divide-y divide-gray-50">
                {[1, 2, 3].map((r) => (
                  <div key={r} className="grid grid-cols-[1fr_180px_180px_120px_40px] gap-4 px-4 py-3 items-center">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 bg-gray-200 rounded-full" />
                      <div className="h-3 w-24 bg-gray-200 rounded" />
                    </div>
                    <div className="h-3 w-28 bg-gray-200 rounded" />
                    <div className="flex justify-end">
                      <div className="h-6 w-20 bg-gray-200 rounded-full" />
                    </div>
                    <div />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
