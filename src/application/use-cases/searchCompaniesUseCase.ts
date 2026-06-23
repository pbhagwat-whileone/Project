import { SupabaseClient } from "@supabase/supabase-js";
import { ConnectionsRepository } from "@/domains/connections/repositories/connectionsRepository";
import { findRecommendedContacts, rankContactsWithMetrics } from "@/domains/companies/services/companyUtils";
import { getCompanyContext } from "@/domains/companies/services/companyContextIntelligence";

export class SearchCompaniesUseCase {
  constructor(private readonly supabase: SupabaseClient) {}

  async execute(userId: string, companyQuery: string) {
    const connectionsRepo = new ConnectionsRepository(this.supabase);

    // 1. Fetch user connections
    const connections = await connectionsRepo.getUserConnections(userId);

    // 2. Group connections
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

    // 3. Get Company Context
    const companyContext = await getCompanyContext(this.supabase, companyQuery);

    // 4. Find recommended contacts for company
    const recommendedContacts = findRecommendedContacts(companyQuery, groupedConnections ?? []);

    if (!recommendedContacts.length) {
      return {
        contacts: [],
        projects: [],
        message: "No matching company could be identified.",
        companyContext,
      };
    }

    // 5. Fetch metrics
    const contactIds = recommendedContacts.map(c => c.id);
    const metricsData = await connectionsRepo.getConnectionMetrics(contactIds);

    const metricsMap: Record<string, any> = {};
    metricsData.forEach(m => {
      metricsMap[m.connection_id] = m;
    });

    // 5. Fetch messages to get last contact date
    await Promise.all(recommendedContacts.map(async (contact) => {
      if (!contact.profile_url) return;
      let urlPattern = "";
      try {
        const urlObj = new URL(contact.profile_url);
        urlPattern = `%${urlObj.pathname.replace(/\/$/, "").toLowerCase()}%`;
      } catch {
        urlPattern = `%${contact.profile_url.replace(/\/$/, "").toLowerCase()}%`;
      }
      
      const messages = await connectionsRepo.getMessagesForUrlPatterns(userId, [urlPattern]);
      
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

    // 6. Rank contacts
    const rankedContacts = rankContactsWithMetrics(recommendedContacts, metricsMap);
    
    return {
      contacts: rankedContacts,
      projects: [], 
      message: rankedContacts.length ? null : "No LinkedIn connection found.",
      companyContext,
    };
  }
}
