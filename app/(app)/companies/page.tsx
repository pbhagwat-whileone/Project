import { CompaniesView } from "@/features/companies/companies-view";
import { Suspense } from "react";

export default function CompaniesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CompaniesView />
    </Suspense>
  );
}
