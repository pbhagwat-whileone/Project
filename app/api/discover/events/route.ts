import { NextResponse } from "next/server";
import { fetchEvents } from "@/services/events-intelligence";
import { createClient, requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    await requireUser();

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    // Read the cache regardless, because we need it as a fallback if Tavily fails or returns 0
    const { data: cacheRow } = await supabase
      .from("discover_events_cache")
      .select("events")
      .eq("id", 1)
      .maybeSingle() as { data: any };

    // 1. Return cache if not explicitly refreshing
    if (!refresh && cacheRow && cacheRow.events && cacheRow.events.length > 0) {
      return NextResponse.json({ data: cacheRow.events, source: "cache" });
    }

    // 2. Fetch fresh events
    const freshEvents = await fetchEvents();
    
    // 3. Cache Policy: Only overwrite if we got valid data
    if (freshEvents && freshEvents.length > 0) {
      await supabase.from("discover_events_cache").upsert({
        id: 1,
        events: freshEvents,
        updated_at: new Date().toISOString()
      } as any);
      return NextResponse.json({ data: freshEvents, source: "fresh" });
    }

    // 4. Fallback Policy: Fetch returned 0. Keep existing cache.
    if (cacheRow && cacheRow.events && cacheRow.events.length > 0) {
       return NextResponse.json({ data: cacheRow.events, source: "cache_fallback" });
    }

    // 5. Total failure: No cache exists, and fetch returned 0.
    return NextResponse.json({ data: [], source: "empty" });

  } catch (error: any) {
    console.error("[Events API] Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events", details: error.message },
      { status: 500 }
    );
  }
}
