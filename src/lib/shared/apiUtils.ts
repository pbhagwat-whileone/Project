import { NextResponse } from "next/server";

export function handleApiError(error: unknown, defaultMessage = "An unexpected error occurred"): NextResponse {
  console.error("API Error:", error);
  const message = error instanceof Error ? error.message : defaultMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}
