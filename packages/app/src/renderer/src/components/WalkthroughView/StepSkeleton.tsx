import { Skeleton } from "@/components/ui/skeleton";

export const StepSkeleton = (): React.JSX.Element => (
  <div aria-hidden="true" className="flex flex-col gap-3 border-l-2 border-transparent pl-4">
    <Skeleton className="h-5 w-2/3" />
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
    </div>
    <div className="flex gap-1.5">
      <Skeleton className="h-4 w-24 rounded-full" />
      <Skeleton className="h-4 w-32 rounded-full" />
    </div>
  </div>
);

export const DescriptionSkeleton = (): React.JSX.Element => (
  <div aria-hidden="true" className="flex flex-col gap-2">
    <Skeleton className="h-5 w-full" />
    <Skeleton className="h-5 w-4/5" />
  </div>
);

export const MasonryCardSkeleton = (): React.JSX.Element => (
  <div aria-hidden="true" className="flex flex-col gap-2 rounded-md border bg-card p-3">
    <Skeleton className="h-[88px] w-full" />
    <Skeleton className="h-3 w-3/4" />
    <Skeleton className="h-3 w-1/2" />
  </div>
);
