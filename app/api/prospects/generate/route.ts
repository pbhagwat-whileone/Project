import { createClient, requireUser } from "@/lib/supabase/server";
import { getCompanyRecommendationsStream } from "@/services/prospect-recommendation";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = getCompanyRecommendationsStream(supabase, user.id);
          for await (const event of generator) {
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          }
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Stream failed";
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', data: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to generate" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
