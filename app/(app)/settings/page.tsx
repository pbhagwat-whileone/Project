import { Suspense } from "react";
import { SettingsView } from "@/features/settings/settings-view";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading settings…" />}>
      <SettingsView />
    </Suspense>
  );
}
