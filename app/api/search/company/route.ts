import { NextResponse } from "next/server";
import { companySearchSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";
import { fetchAllRecords } from "@/utils/supabase-utils";
import { findRecommendedContacts, rankContactsWithMetrics } from "@/utils/company-utils";
import { searchKnowledgeChunks } from "@/services/vector-search";
import { getCompanyContext } from "@/services/company-context-intelligence";

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

    const { count: actualCount } = await supabase
      .from("connections")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const queryBuilder = supabase
      .from("connections")
      .select("*, connection_profiles(*)")
      .eq("user_id", user.id);

    const connections = await fetchAllRecords<any>(queryBuilder);

    const uniqueMap = new Map<string, any>();
    connections.forEach((c: any) => {
      const key = c.profile_url?.toLowerCase()?.trim() || `${c.first_name?.toLowerCase()?.trim() || ""}|${c.last_name?.toLowerCase()?.trim() || ""}|${c.company?.toLowerCase()?.trim() || ""}`;
      
      if (uniqueMap.has(key)) {
        const existing = uniqueMap.get(key)!;
        if (c.connection_owner_name && !existing.connection_owners.includes(c.connection_owner_name)) {
          existing.connection_owners.push(c.connection_owner_name);
        }
      } else {
        uniqueMap.set(key, { ...c, connection_owners: c.connection_owner_name ? [c.connection_owner_name] : [] });
      }
    });

    const groupedConnections = Array.from(uniqueMap.values()).map(c => ({
      ...c,
      connection_owner_name: c.connection_owners.join(", ")
    }));


    const recommendedContacts = findRecommendedContacts(
      parsed.data.company,
      groupedConnections ?? []
    );

    if (!recommendedContacts.length) {
      return NextResponse.json({
        contacts: [],
        projects: [],
        message: "No matching company could be identified.",
      });
    }

    // Fetch metrics for all recommended contacts
    const contactIds = recommendedContacts.map(c => c.id);

    const { data: metricsData } = await supabase
      .from("connection_relationship_metrics")
      .select("*")
      .in("connection_id", contactIds);

    const metricsMap: Record<string, any> = {};
    metricsData?.forEach(m => {
      metricsMap[m.connection_id] = m;
    });

    await Promise.all(recommendedContacts.map(async (contact) => {
      if (!contact.profile_url) return;
      let urlPattern = "";
      try {
        const urlObj = new URL(contact.profile_url);
        urlPattern = `%${urlObj.pathname.replace(/\/$/, "").toLowerCase()}%`;
      } catch {
        urlPattern = `%${contact.profile_url.replace(/\/$/, "").toLowerCase()}%`;
      }
      
      const { data: messages } = await supabase
        .from("linkedin_messages")
        .select("date")
        .eq("user_id", user.id)
        .or(`from_profile_url.ilike.${urlPattern},to_profile_url.ilike.${urlPattern}`);
      
      if (messages && messages.length > 0) {
        if (!metricsMap[contact.id]) {
          metricsMap[contact.id] = {};
        }
        metricsMap[contact.id].message_count = messages.length;
        
        let maxDate = messages[0].date;
        for (const msg of messages) {
           if (msg.date && (!maxDate || new Date(msg.date) > new Date(maxDate))) {
             maxDate = msg.date;
           }
        }
        metricsMap[contact.id].last_contact_date = maxDate;
      }
    }));

    const rankedContacts = rankContactsWithMetrics(recommendedContacts, metricsMap);
    
    return NextResponse.json({
      contacts: rankedContacts,
      projects: [], // Projects are now fetched at the connection level
      message: rankedContacts.length ? null : "No LinkedIn connection found.",
    });


  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
