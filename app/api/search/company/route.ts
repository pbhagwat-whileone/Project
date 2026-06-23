import { NextResponse } from "next/server";
import { companySearchSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";
import { SearchCompaniesUseCase } from "@/application/use-cases/searchCompaniesUseCase";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = companySearchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const useCase = new SearchCompaniesUseCase(supabase);
    
    const result = await useCase.execute(user.id, parsed.data.company);

    try {
      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(path.join(process.cwd(), 'test-output.json'), JSON.stringify(result, null, 2));
    } catch (e) {
      console.error("Failed to write to test-output.json", e);
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
