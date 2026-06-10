import { ProspectsView } from "@/features/prospects/prospects-view";
import { Suspense } from "react";

export default function ProspectsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProspectsView />
    </Suspense>
  );
}
