import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";
import {
  analyzeIndustryExpertise,
  generateAndCacheRecommendations,
} from "@/services/prospect-recommendation";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const [recommendations, expertise] = await Promise.all([
      generateAndCacheRecommendations(supabase, user.id),
      analyzeIndustryExpertise(supabase, user.id),
    ]);

    const ranked = recommendations.map((rec, index) => ({
      rank: index + 1,
      ...rec,
    }));

    return NextResponse.json({ recommendations: ranked, expertise });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate recommendations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
