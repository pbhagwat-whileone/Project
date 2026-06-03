import { NextResponse } from "next/server";
import { recommendationDetailSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";
import { getCompanyDetail } from "@/services/prospect-recommendation";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const parsed = recommendationDetailSchema.safeParse({
      company: searchParams.get("company"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const detail = await getCompanyDetail(supabase, user.id, parsed.data.company);

    if (!detail) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ detail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load detail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
