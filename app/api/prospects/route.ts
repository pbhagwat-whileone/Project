import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";
import {
  analyzeIndustryExpertise,
  getCompanyRecommendations,
} from "@/services/prospect-recommendation";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const minScoreParam = searchParams.get("minScore");
    const filters = {
      industry: searchParams.get("industry") ?? undefined,
      country: searchParams.get("country") ?? undefined,
      companySize: searchParams.get("companySize") ?? undefined,
      revenueBand: searchParams.get("revenueBand") ?? undefined,
      minScore: minScoreParam ? Number(minScoreParam) : undefined,
      q: searchParams.get("q") ?? undefined,
    };

    const [recommendations, expertise] = await Promise.all([
      getCompanyRecommendations(supabase, user.id, filters),
      analyzeIndustryExpertise(supabase, user.id),
    ]);

    const ranked = recommendations.map((rec, index) => ({
      rank: index + 1,
      ...rec,
    }));

    return NextResponse.json({ recommendations: ranked, expertise });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
