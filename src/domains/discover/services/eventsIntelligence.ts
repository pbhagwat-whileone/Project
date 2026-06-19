import { generateWithFallback } from "@/services/ai/generation/generation";

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
  "AI and GenAI conferences India 2026",
  "Cloud, Data Center, and Infrastructure conferences India 2026",
  "Semiconductor and RISC-V conferences India 2026",
  "AI and Cloud conferences Asia 2026",
  "Semiconductor conferences Asia 2026",
  "AI, Cloud, and HPC conferences Europe 2026",
  "AI and Semiconductor conferences North America 2026"
];

const EVENT_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          date: { type: "string" },
          location: { type: "string" },
          website: { type: "string" },
          description: { type: "string" },
          techTags: { 
            type: "array", 
            items: { type: "string" } 
          }
        },
        required: ["name", "date", "location", "website", "description", "techTags"]
      }
    }
  },
  required: ["events"]
};

export async function fetchEvents(): Promise<EventItem[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    console.warn("[Events Intelligence] Missing TAVILY_API_KEY");
    return [];
  }

  const allExtractedEvents: EventItem[] = [];

  try {
    const promises = SEARCH_QUERIES.map(async (query) => {
      const requestStart = Date.now();
      let tavilyDuration = 0;
      let llmDuration = 0;
      let parseDuration = 0;

      try {
        const tavilyStart = Date.now();
        const searchResponse = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: query,
            search_depth: "advanced",
            include_answer: false,
            include_raw_content: false,
            max_results: 5,
            days: 30,
          }),
        });
        
        tavilyDuration = Date.now() - tavilyStart;

        if (!searchResponse.ok) return [];

        const searchData = await searchResponse.json();
        if (!searchData.results || searchData.results.length === 0) return [];

        const rawContext = searchData.results.map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join("\n\n");

        const prompt = `Extract a list of upcoming technology events, conferences, summits, or expos from the following search results.
        
Search Results:
${rawContext}

- For date, format it as YYYY-MM-DD or Month DD, YYYY.
- Filter strictly to only include events relevant to: ${TECH_AREAS.join(", ")}.
- If no upcoming events are found, return an empty array for events.`;

        const llmStart = Date.now();
        const aiResult = await generateWithFallback(prompt, "EVENTS_INTELLIGENCE", { 
          isJson: true,
          responseSchema: EVENT_SCHEMA
        });
        llmDuration = Date.now() - llmStart;

        const parseStart = Date.now();
        let parsed: any;
        try {
          parsed = JSON.parse(aiResult.text);
        } catch (parseErr) {
          const cleaned = aiResult.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          parsed = JSON.parse(cleaned);
        }
        parseDuration = Date.now() - parseStart;
        
        const totalDuration = Date.now() - requestStart;


        return parsed.events || [];
      } catch (err) {
        console.warn(`[Events Intelligence] Error processing query "${query}":`, err);
        return [];
      }
    });

    const batchResults = await Promise.all(promises);

    for (const extractedArr of batchResults) {
      if (extractedArr && extractedArr.length > 0) {
        for (const ev of extractedArr) {
          allExtractedEvents.push({
            ...ev,
            id: `evt-${Date.now()}-${Math.random().toString(36).substring(2)}`
          });
        }
      }
    }

    // Deduplication (by name and location similarity)
    const uniqueEventsMap = new Map<string, EventItem>();

    for (const event of allExtractedEvents) {
      if (!event.name || event.name.length < 5) continue; // skip junk

      // simple normalized key
      const key = event.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!uniqueEventsMap.has(key)) {
        uniqueEventsMap.set(key, event);
      }
    }

    const deduplicatedEvents = Array.from(uniqueEventsMap.values());

    // Date Validation (Remove past events)
    const now = new Date();
    // Reset to start of day for fair comparison
    now.setHours(0, 0, 0, 0);

    const finalEvents: EventItem[] = [];

    for (const event of deduplicatedEvents) {
      if (!event.date) continue;

      let eventDate: Date;
      try {
        eventDate = new Date(event.date);
        if (isNaN(eventDate.getTime())) {
          if (event.date.includes("2026") || event.date.includes("2027")) {
            finalEvents.push(event);
          }
          continue;
        }
      } catch (e) {
        continue;
      }

      if (eventDate >= now) {
        finalEvents.push(event);
      }
    }

    // Sort by date nearest to furthest
    finalEvents.sort((a, b) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateA - dateB;
    });

    return finalEvents;
  } catch (error) {
    console.error("[Events Intelligence] Error fetching events:", error);
    return [];
  }
}
