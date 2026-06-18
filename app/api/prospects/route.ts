import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";
import { getCompanyRecommendations } from "@/domains/prospects/services/prospectRecommendation";
import { handleApiError } from "@/lib/shared/apiUtils";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const recommendations = await getCompanyRecommendations(supabase, user.id);

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const range = searchParams.get("range");
    const page = searchParams.get("page");


    const ranked = recommendations.map((rec, index) => ({
      rank: index + 1,
      ...rec,
    }));

    return NextResponse.json({ recommendations: ranked });
  } catch (err) {
    return handleApiError(err, "Failed to load");
  }
}
