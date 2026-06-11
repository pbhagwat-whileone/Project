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

    console.log(`[ApolloEnrichment] Looking up: ${linkedinUrl}`);
    
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
    
    console.log("[ApolloEnrichment] Request Payload:", payload);
    console.log("[ApolloEnrichment] Endpoint:", endpoint);

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
      console.log("[ApolloEnrichment] Status:", response.status);
      console.log("[ApolloEnrichment] Error Body:", errorBody);
      return null;
    }

    const data = await response.json();
    
    // Apollo usually returns a person object upon match
    if (data.person && data.person.email) {
      const email = data.person.email;
      const status = data.person.email_status || "unknown";
      const confidence = data.person.email_confidence ? parseFloat(data.person.email_confidence) : null;
      
      console.log(`[ApolloEnrichment] Email Found: ${email}`);
      return {
        email,
        email_status: status,
        email_confidence: confidence !== null ? confidence : undefined
      };
    } else {
      console.log("[ApolloEnrichment] No Email Found");
      return null;
    }
  } catch (err) {
    console.error("[ApolloEnrichment] API Error:", err);
    return null;
  }
}
