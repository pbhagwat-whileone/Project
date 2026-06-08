import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAllRecords } from "@/utils/supabase-utils";

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "5334460f-9076-4d04-b695-a4b51909a3dc"; // A common test UUID or we just query all

    const id = "d9a177d2-831e-4931-ba63-e4d2c417d1cb";
    
    // 1. Check exact ID in DB
    const { data: exactRows, error: exactError } = await supabase
      .from("connections")
      .select("*")
      .eq("id", id);

    // 2. Run fetchAllRecords exactly as we do in the app
    const query = supabase
      .from("connections")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
      
    if (userId) {
      // Actually, if we don't know the userId, we might just query all.
      // But let's just run it to see if fetchAllRecords overlaps.
      query.eq("user_id", exactRows?.[0]?.user_id || userId);
    }
    
    const allRecords = await fetchAllRecords<any>(query);
    const allIds = allRecords.map(r => r.id);
    const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
    
    // 3. Find if profile_url duplicated in DB for this user
    const { data: dupeCheck } = await supabase
      .from("connections")
      .select("id, profile_url, first_name, last_name, company")
      .eq("user_id", exactRows?.[0]?.user_id || userId);
      
    const profileUrls = dupeCheck?.map(r => r.profile_url).filter(Boolean) || [];
    const dupeUrls = profileUrls.filter((u, i) => profileUrls.indexOf(u) !== i);

    return NextResponse.json({
      databaseCountForId: exactRows?.length,
      databaseRowsForId: exactRows,
      fetchAllRecordsCount: allRecords.length,
      fetchAllRecordsUniqueCount: new Set(allIds).size,
      fetchAllRecordsDuplicates: duplicates.length,
      fetchAllRecordsDuplicateIds: duplicates,
      dupeProfileUrlsCount: dupeUrls.length,
      sampleDupeUrls: dupeUrls.slice(0, 5)
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : JSON.stringify(err) }, { status: 500 });
  }
}
