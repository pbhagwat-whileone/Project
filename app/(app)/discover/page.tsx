import { DiscoverView } from "@/features/discover/discover-view";
import { Suspense } from "react";

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DiscoverView />
    </Suspense>
  );
}
