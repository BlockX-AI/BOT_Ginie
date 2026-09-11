"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ProfileSkeleton() {
  return (
    <div className="min-h-screen w-full relative bg-black">
      <div className="absolute inset-0 z-0 bg-black" />

      <div className="relative z-10 min-h-[calc(100vh-60px)] flex flex-col items-center px-6 py-10 mt-24">
        <div className="w-full max-w-6xl space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <Skeleton className="h-9 w-32 bg-white/10" />
              <Skeleton className="h-4 w-64 mt-2 bg-white/5" />
            </div>
            <Skeleton className="h-10 w-28 bg-white/10" />
          </div>

          {/* Profile Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-center gap-4">
                {/* Avatar skeleton */}
                <Skeleton className="w-16 h-16 rounded-full bg-white/10" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48 bg-white/5" />
                  <Skeleton className="h-5 w-32 bg-white/10" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full bg-white/5" />
                    <Skeleton className="h-5 w-20 rounded-full bg-white/5" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-32 bg-white/10" />
                <Skeleton className="h-10 w-24 bg-white/5" />
              </div>
            </div>
          </div>

          {/* Form Skeleton */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <div className="space-y-6">
              {/* Section title */}
              <Skeleton className="h-6 w-40 bg-white/10" />
              
              {/* Form fields grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24 bg-white/5" />
                    <Skeleton className="h-10 w-full bg-white/10" />
                  </div>
                ))}
              </div>

              {/* Another section */}
              <Skeleton className="h-6 w-32 mt-8 bg-white/10" />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-20 bg-white/5" />
                    <Skeleton className="h-10 w-full bg-white/10" />
                  </div>
                ))}
              </div>

              {/* Save button area */}
              <div className="flex justify-end pt-4">
                <Skeleton className="h-10 w-32 bg-white/10" />
              </div>
            </div>
          </div>

          {/* Stats section */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <Skeleton className="h-6 w-24 mb-4 bg-white/10" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 bg-white/5 rounded-lg">
                  <Skeleton className="h-8 w-16 bg-white/10" />
                  <Skeleton className="h-4 w-24 mt-2 bg-white/5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function JobDetailSkeleton() {
  return (
    <div className="min-h-screen w-full bg-black relative overflow-hidden">
      <div className="relative z-10 h-screen flex flex-col">
        {/* Header skeleton */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded bg-white/10" />
              <Skeleton className="h-6 w-32 bg-white/10" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full bg-white/10" />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left panel - Thinking */}
            <div className="bg-black border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-5 w-24 bg-white/10" />
                <Skeleton className="h-4 w-32 bg-white/5" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-4 w-full bg-white/5" style={{ width: `${100 - i * 10}%` }} />
                ))}
              </div>
            </div>

            {/* Right panel - Files */}
            <div className="bg-black border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-9 w-24 rounded-lg bg-white/10" />
                <Skeleton className="h-9 w-24 rounded-lg bg-white/5" />
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full bg-white/5" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded bg-white/10" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48 bg-white/10" />
                <Skeleton className="h-4 w-32 bg-white/5" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-full bg-white/10" />
              <Skeleton className="h-8 w-8 rounded bg-white/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ProfileSkeleton;
