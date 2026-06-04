import { memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Full page loading skeleton for lazy-loaded pages
 * Provides visual feedback during code chunk loading
 */
const PageLoader = memo(() => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="h-16 border-b bg-card flex items-center px-6 gap-4">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-6 w-48" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      
      <div className="flex">
        {/* Sidebar skeleton */}
        <div className="w-64 border-r bg-sidebar-background min-h-[calc(100vh-4rem)] p-4 space-y-4 hidden lg:block">
          <Skeleton className="h-10 w-full bg-sidebar-accent" />
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full bg-sidebar-accent" />
            ))}
          </div>
        </div>
        
        {/* Main content skeleton */}
        <div className="flex-1 p-6 space-y-6">
          {/* Page title */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          
          {/* Stats cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-6 rounded-xl border bg-card">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
          
          {/* Content area skeleton */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-9 w-32" />
            </div>
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

PageLoader.displayName = "PageLoader";

export default PageLoader;
