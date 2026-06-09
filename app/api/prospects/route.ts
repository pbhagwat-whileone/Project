import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";
import { getCompanyRecommendations } from "@/services/prospect-recommendation";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const recommendations = await getCompanyRecommendations(supabase, user.id);

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const range = searchParams.get("range");
    const page = searchParams.get("page");

    console.log("QUERY LIMIT:", limit);
    console.log("QUERY RANGE:", range);
    console.log("QUERY PAGE:", page);
    console.log("COMPANIES RETURNED:", recommendations.length);

    const ranked = recommendations.map((rec, index) => ({
      rank: index + 1,
      ...rec,
    }));

    return NextResponse.json({ recommendations: ranked });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
