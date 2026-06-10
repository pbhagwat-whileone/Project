import { SearchCompanyView } from "@/features/search/search-company-view";
import { Suspense } from "react";

export default function SearchCompanyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchCompanyView />
    </Suspense>
  );
}
