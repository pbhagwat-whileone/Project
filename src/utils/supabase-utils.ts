

/**
 * Iteratively fetches all records from a Supabase query builder to bypass the default 1000-record limit.
 * 
 * @param queryBuilder - A Supabase Postgrest filter/select builder.
 * @param pageSize - The maximum number of records to fetch per request. Defaults to 1000.
 * @returns A promise that resolves to the complete array of records.
 */
export async function fetchAllRecords<T>(
  queryBuilder: any,
  pageSize: number = 1000
): Promise<T[]> {
  let allData: T[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    // Clear the cached promise so the builder fetches fresh data
    if ('_promise' in queryBuilder) {
      (queryBuilder as any)._promise = undefined;
    }

    const { data, error } = await queryBuilder.range(from, to);

    if (error) {
      console.error("fetchAllRecords error:", error);
      throw error;
    }

    if (data && data.length > 0) {
      console.log(`[fetchAllRecords] fetched ${data.length} rows for page ${page}`);
      
      // check for duplicates within the current batch and allData
      const currentIds = (data as any[]).map(d => d.id).filter(Boolean);
      const allIds = allData.map(d => (d as any).id).filter(Boolean);
      const overlap = currentIds.filter(id => allIds.includes(id));
      if (overlap.length > 0) {
        console.warn(`[fetchAllRecords] OVERLAP DETECTED! ${overlap.length} duplicate IDs found between page ${page} and previous pages.`);
      }

      allData = allData.concat(data as T[]);
      if (data.length < pageSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }

    page++;
  }

  return allData;
}
