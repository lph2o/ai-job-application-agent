import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export function JobCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-2 w-24 rounded-full" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="size-8 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
