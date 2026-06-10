import { ConnectionsView } from "@/features/connections/connections-view";
import { Suspense } from "react";

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConnectionsView />
    </Suspense>
  );
}
