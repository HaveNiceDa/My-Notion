import { Skeleton } from "@/src/components/ui/skeleton";
import { Cover } from "@/src/components/Cover";

export default function Loading() {
  return (
    <div className="pb-40">
      <Cover url={undefined} />
      <div className="md:max-w-3xl lg:md-max-w-4xl mx-auto">
        <div className="space-y-4 pl-8 pt-4">
          <Skeleton className="h-14 w-[50%]" />
          <Skeleton className="h-14 w-[80%]" />
          <Skeleton className="h-14 w-[40%]" />
          <Skeleton className="h-14 w-[60%]" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    </div>
  );
}