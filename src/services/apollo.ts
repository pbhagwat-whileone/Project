export interface ApolloEmailResponse {
  email?: string;
  email_status?: string;
  email_confidence?: number;
}

export async function getApolloEmailByLinkedInUrl(
  linkedinUrl: string,
  organizationName?: string | null,
  domain?: string | null
): Promise<ApolloEmailResponse | null> {
  if (!linkedinUrl) return null;

  try {
    const apolloKey = process.env.APOLLO_API_KEY;
    if (!apolloKey || apolloKey === "your_apollo_api_key_here") {
      console.warn("[ApolloEnrichment] Missing APOLLO_API_KEY.");
      return null;
    }

    // console.log(`[ApolloEnrichment] Looking up: ${linkedinUrl}`);
    
    // Construct the payload with optional organization/domain fields for better matching
    const payload: any = {
      linkedin_url: linkedinUrl,
    };
    
    if (organizationName) {
      payload.organization_name = organizationName;
    }
    
    if (domain) {
      payload.domain = domain;
    }

    const endpoint = "https://api.apollo.io/v1/people/match";
    
    // console.log("[ApolloEnrichment] Request Payload:", payload);
    // console.log("[ApolloEnrichment] Endpoint:", endpoint);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apolloKey
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // console.log("[ApolloEnrichment] Status:", response.status);
      // console.log("[ApolloEnrichment] Error Body:", errorBody);
      return null;
    }

    const data = await response.json();
    
    // Apollo usually returns a person object upon match
    if (data.person && data.person.email) {
      const email = data.person.email;
      const status = data.person.email_status || "unknown";
      const confidence = data.person.email_confidence ? parseFloat(data.person.email_confidence) : null;
      
      // console.log(`[ApolloEnrichment] Email Found: ${email}`);
      return {
        email,
        email_status: status,
        email_confidence: confidence !== null ? confidence : undefined
      };
    } else {
      // console.log("[ApolloEnrichment] No Email Found");
      return null;
    }
  } catch (err) {
    console.error("[ApolloEnrichment] API Error:", err);
    return null;
  }
}

export interface ApolloPerson {
  id?: string;
  name: string;
  first_name: string;
  last_name: string;
  last_name_obfuscated?: string;
  linkedin_url: string;
  linkedin_profile_url?: string;
  linkedin?: string;
  website_url?: string;
  title: string;
  organization?: { name: string };
  city?: string;
  state?: string;
  country?: string;
}

export async function searchApolloPeople(
  company: string,
  roles: string[] = [],
  tags: string[] = [],
  departments: string[] = [],
  seniorities: string[] = []
): Promise<ApolloPerson[]> {
  try {
    const apolloKey = process.env.APOLLO_API_KEY;
    if (!apolloKey || apolloKey === "your_apollo_api_key_here") {
      console.warn("[ApolloSearch] Missing APOLLO_API_KEY.");
      return [];
    }

    let domain = company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    try {
      const clearbitRes = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(company)}`);
      if (clearbitRes.ok) {
        const clearbitData = await clearbitRes.json();
        if (clearbitData && clearbitData.length > 0 && clearbitData[0].domain) {
          domain = clearbitData[0].domain;
        }
      }
    } catch (e) {
      console.warn("[ApolloSearch] Clearbit domain lookup failed, using fallback:", domain);
    }

    const payload: any = {
      q_organization_domains: domain,
      page: 1,
      per_page: 15, // request more to have enough after filtering
    };

    if (roles && roles.length > 0) {
      payload.person_titles = roles;
    }
    
    if (departments && departments.length > 0) {
      payload.person_departments = departments;
    }

    if (seniorities && seniorities.length > 0) {
      payload.person_seniorities = seniorities;
    }
    
    // Apollo uses person_locations, q_keywords, etc. We use q_keywords for tags
    if (tags.length > 0) {
       payload.q_keywords = tags.join(" ");
    }
    
    // console.log("[ApolloSearch] Payload:", payload);

    const endpoint = "https://api.apollo.io/v1/mixed_people/api_search";
    // console.log("[ApolloSearch] Endpoint:", endpoint);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apolloKey
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // console.log("[ApolloSearch] Status:", response.status);
      // console.log("[ApolloSearch] Response Body:", errorBody);
      return [];
    }

    const data = await response.json();
    const people = data.people || [];
    
    // console.log("[ApolloSimilar] Returned Count:", people.length);
    // console.log("[ApolloSimilar] Raw Results:", people);
    
    return people;
  } catch (error) {
    console.error("[ApolloSearch] Failed:", error);
    return [];
  }
}

export async function enrichApolloPerson(personId: string): Promise<ApolloPerson | null> {
  try {
    const apolloKey = process.env.APOLLO_API_KEY;
    if (!apolloKey) {
      console.warn("APOLLO_API_KEY not found.");
      return null;
    }

    const endpoint = "https://api.apollo.io/v1/people/match";
    const payload = { id: personId };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apolloKey
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[ApolloEnrichment] Failed for ${personId}:`, response.status);
      return null;
    }

    const data = await response.json();
    return data.person || null;
  } catch (err) {
    console.error(`[ApolloEnrichment] Error enriching ${personId}:`, err);
    return null;
  }
}
