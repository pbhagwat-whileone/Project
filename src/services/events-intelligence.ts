import { generateWithFallback } from "@/ai/generation";

export interface EventItem {
  id: string;
  name: string;
  date: string;
  location: string;
  website: string;
  description: string;
  techTags: string[];
}

const TECH_AREAS = [
  "AI", "GenAI",
  "Cloud Infrastructure",
  "HPC",
  "Semiconductors",
  "Data Centers",
  "Edge Computing",
  "Platform Engineering",
  "SRE",
  "MLOps",
  "RISC-V",
  "ARM"
];

// Target searches prioritizing India as requested
const SEARCH_QUERIES = [
  "AI conferences India 2026",
  "GenAI conferences India 2026",
  "Cloud conferences India 2026",
  "Semiconductor conferences India 2026",
  "Data Center conferences India 2026",
  "RISC-V conferences India 2026",
  "AI conferences Asia 2026",
  "Cloud Infrastructure conferences Asia 2026",
  "Semiconductor conferences Asia 2026",
  "AI conferences Europe 2026",
  "Cloud conferences Europe 2026",
  "HPC conferences Europe 2026",
  "AI conferences North America 2026",
  "Semiconductor conferences North America 2026"
];

const CHUNK_SIZE = 5; // number of parallel Tavily/LLM calls at once

export async function fetchEvents(): Promise<EventItem[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    console.warn("[Events Intelligence] Missing TAVILY_API_KEY");
    return [];
  }

  let totalTavilySearches = 0;
  let totalRawResults = 0;
  let totalCandidateEvents = 0;
  let firstRawResult: any = null;
  let firstExtractedEvent: any = null;

  const allExtractedEvents: EventItem[] = [];

  try {
    // console.log(`[Events Intelligence] Starting ${SEARCH_QUERIES.length} parallel searches in batches...`);

    // Process in batches
    for (let i = 0; i < SEARCH_QUERIES.length; i += CHUNK_SIZE) {
      const batchQueries = SEARCH_QUERIES.slice(i, i + CHUNK_SIZE);

      const batchPromises = batchQueries.map(async (query) => {
        try {
          totalTavilySearches++;
          const searchResponse = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: tavilyKey,
              query: query,
              search_depth: "advanced",
              include_answer: false,
              include_raw_content: false,
              max_results: 5, // keep it focused per query
              days: 30, // recent announcements
            }),
          });

          if (!searchResponse.ok) return [];

          const searchData = await searchResponse.json();
          if (!searchData.results || searchData.results.length === 0) return [];

          totalRawResults += searchData.results.length;
          if (!firstRawResult) firstRawResult = searchData.results[0];

          const rawContext = searchData.results.map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join("\n\n");

          const prompt = `Extract a list of upcoming technology events, conferences, summits, or expos from the following search results.
          
Search Results:
${rawContext}

Respond in JSON ONLY with exactly the following structure:
{
  "events": [
    {
      "name": "Event Name",
      "date": "YYYY-MM-DD",
      "location": "City, Country or Virtual",
      "website": "URL from the search result",
      "description": "Short description of the event",
      "techTags": ["Tag1", "Tag2"]
    }
  ]
}

- For date, do your best to format it as YYYY-MM-DD or Month DD, YYYY.
- Filter strictly to only include events relevant to: ${TECH_AREAS.join(", ")}.
- If no upcoming events are found, return an empty array for events.`;

          const aiResult = await generateWithFallback(prompt, "EVENTS_INTELLIGENCE", { isJson: true });

          let parsed: any;
          try {
            parsed = JSON.parse(aiResult.text);
          } catch (parseErr) {
            const cleaned = aiResult.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            parsed = JSON.parse(cleaned);
          }

          return parsed.events || [];
        } catch (err) {
          console.warn(`[Events Intelligence] Error processing query "${query}":`, err);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const extractedArr of batchResults) {
        if (extractedArr && extractedArr.length > 0) {
          totalCandidateEvents += extractedArr.length;
          if (!firstExtractedEvent) firstExtractedEvent = extractedArr[0];

          for (const ev of extractedArr) {
            allExtractedEvents.push({
              ...ev,
              id: `evt-${Date.now()}-${Math.random().toString(36).substring(2)}`
            });
          }
        }
      }
    }

    // Deduplication (by name and location similarity)
    const uniqueEventsMap = new Map<string, EventItem>();
    let duplicatesRemoved = 0;

    for (const event of allExtractedEvents) {
      if (!event.name || event.name.length < 5) continue; // skip junk

      // simple normalized key
      const key = event.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (uniqueEventsMap.has(key)) {
        duplicatesRemoved++;
      } else {
        uniqueEventsMap.set(key, event);
      }
    }

    const deduplicatedEvents = Array.from(uniqueEventsMap.values());

    // Date Validation (Remove past events)
    const now = new Date();
    // Reset to start of day for fair comparison
    now.setHours(0, 0, 0, 0);

    let pastEventsRemoved = 0;
    const finalEvents: EventItem[] = [];

    for (const event of deduplicatedEvents) {
      if (!event.date) continue;

      // attempt to parse the date. If it fails or is past, drop it.
      let eventDate: Date;
      try {
        eventDate = new Date(event.date);
        if (isNaN(eventDate.getTime())) {
          // If we can't parse it, we might want to keep it just in case, or drop it.
          // Since strict validation is requested, let's keep it if it contains "2026" or "2027" as a fallback check
          if (event.date.includes("2026") || event.date.includes("2027")) {
            finalEvents.push(event);
          } else {
            pastEventsRemoved++;
          }
          continue;
        }
      } catch (e) {
        pastEventsRemoved++;
        continue;
      }

      if (eventDate < now) {
        pastEventsRemoved++;
      } else {
        finalEvents.push(event);
      }
    }

    // Sort by date nearest to furthest
    finalEvents.sort((a, b) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateA - dateB;
    });

    // console.log("=========================================");
    // console.log("[Events Intelligence Debug Report]");
    // console.log(`- Tavily searches executed: ${totalTavilySearches}`);
    // console.log(`- Raw results returned: ${totalRawResults}`);
    // console.log(`- Candidate events extracted: ${totalCandidateEvents}`);
    // console.log(`- Removed as duplicates: ${duplicatesRemoved}`);
    // console.log(`- Removed due to invalid/past dates: ${pastEventsRemoved}`);
    // console.log(`- Final number returned to UI: ${finalEvents.length}`);

    if (firstRawResult) {
      // console.log("\n[Example Raw Tavily Result]");
      // console.log(`Title: ${firstRawResult.title}`);
      // console.log(`URL: ${firstRawResult.url}`);
      // console.log(`Snippet: ${firstRawResult.content.substring(0, 100)}...`);
    }

    if (firstExtractedEvent) {
      // console.log("\n[Example Extracted Event]");
      // console.log(JSON.stringify(firstExtractedEvent, null, 2));
    }
    // console.log("=========================================");

    return finalEvents;
  } catch (error) {
    console.error("[Events Intelligence] Error fetching events:", error);
    return [];
  }
}
