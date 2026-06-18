import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";
import { searchApolloPeople, enrichApolloPerson } from "@/services/integrations/apollo/apollo";
import { generateCompanyStakeholderSearchStrategy } from "@/domains/prospects/services/stakeholderDiscovery";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { company } = body;

    if (!company) {
      return NextResponse.json({ error: "Company is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Check Cache
    const companyNormalized = company.trim().toLowerCase();
    const { data: cacheHit } = await supabase
      .from("company_similar_contacts_cache")
      .select("results, created_at")
      .eq("company_name", companyNormalized)
      .single();

    if (cacheHit) {
      const cacheDate = new Date(cacheHit.created_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (cacheDate > thirtyDaysAgo) {
        return NextResponse.json({ contacts: cacheHit.results });
      } else {
      }
    }


    // 2. Fetch existing connections
    const { data: existingConnections } = await supabase
      .from("connections")
      .select("first_name, last_name, company, position, profile_url")
      .not("profile_url", "is", null);

    const existingRoles = existingConnections?.map(c => c.position).filter(Boolean) as string[] || [];
    
    // 3. Generate Strategy
    const strategy = await generateCompanyStakeholderSearchStrategy(
      company,
      existingRoles,
      [], // expertise_tags
      [], // technology_tags
      []  // activity_signals
    );

    // 4. Fetch from Apollo
    const apolloResults = await searchApolloPeople(
      company,
      strategy.titles || [],
      [],
      strategy.departments || [],
      strategy.seniorities || []
    );

    if (apolloResults.length === 0) {
      return NextResponse.json({ contacts: [] });
    }

    // 5. Exclude existing contacts
    const normalizeName = (name: string | null | undefined) => (name || "").replace(/\s+/g, " ").trim().toLowerCase();
    const normalizeUrl = (url: string | null | undefined) => {
      if (!url) return "";
      return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").trim();
    };

    const existingUrls = new Set(
      existingConnections?.map(c => normalizeUrl(c.profile_url)).filter(Boolean)
    );
    const existingNames = new Set(
      existingConnections?.map(c => normalizeName(`${c.first_name || ""} ${c.last_name || ""}`)).filter(Boolean)
    );

    const candidatesToHydrate = apolloResults.slice(0, 10);
    
    const hydratedContacts = await Promise.all(
      candidatesToHydrate.map(async (person) => {
        let displayName = person.first_name || "";
        if (person.last_name) {
          displayName += " " + person.last_name;
        } else if (person.last_name_obfuscated) {
          displayName += " " + person.last_name_obfuscated;
        }
        displayName = normalizeName(displayName) || normalizeName(person.name) || "unknown";

        let profileUrl = person.linkedin_url || person.linkedin_profile_url || person.linkedin || person.website_url || null;

        const contact = {
          id: person.id,
          name: displayName,
          position: person.title,
          company: person.organization?.name || company,
          linkedin_url: profileUrl,
          apollo_url: person.id ? `https://app.apollo.io/#/people/${person.id}` : null,
          location: [person.city, person.state, person.country].filter(Boolean).join(", ") || null
        };

        if (!contact.id) return contact;
        
        const enriched = await enrichApolloPerson(contact.id);
        if (!enriched) return contact;

        let enrichedName = enriched.first_name || "";
        if (enriched.last_name) {
          enrichedName += " " + enriched.last_name;
        } else if (enriched.last_name_obfuscated) {
          enrichedName += " " + enriched.last_name_obfuscated;
        }
        enrichedName = normalizeName(enrichedName) || normalizeName(enriched.name) || contact.name;

        return {
          ...contact,
          name: enrichedName,
          linkedin_url: enriched.linkedin_url || contact.linkedin_url
        };
      })
    );

    const filteredContacts = hydratedContacts.filter(person => {
      const personUrl = normalizeUrl(person.linkedin_url);
      const personName = normalizeName(person.name);

      if (personUrl && existingUrls.has(personUrl)) {
        return false;
      }
      if (personName && existingNames.has(personName)) {
        return false;
      }
      return true;
    });

    const finalContacts = filteredContacts.slice(0, 5).map(person => ({
      ...person,
      name: person.name.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
    }));

    // 6. Write to Cache
    if (finalContacts.length > 0) {
      await supabase.from("company_similar_contacts_cache").upsert({
        user_id: user.id,
        company_name: companyNormalized,
        results: finalContacts,
        created_at: new Date().toISOString()
      }, { onConflict: "company_name" });
    }

    return NextResponse.json({
      contacts: finalContacts
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
