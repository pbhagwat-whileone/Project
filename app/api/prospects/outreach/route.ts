import { NextResponse } from "next/server";
import { recommendationOutreachSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";
import { generateOutreachEmail } from "@/services/email-generator";
import { getRecommendationForEmail } from "@/services/prospect-recommendation";
import { evaluateRelationshipIntelligence } from "@/services/relationship-intelligence";
import { searchKnowledgeChunks } from "@/services/vector-search";
import { getCompanyContext } from "@/services/company-context-intelligence";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = recommendationOutreachSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { recommendation, matchingProjects } =
      await getRecommendationForEmail(
        supabase,
        user.id,
        parsed.data.company_name
      );

    if (!recommendation?.topContact) {
      return NextResponse.json(
        { error: "No contact found for this company" },
        { status: 404 }
      );
    }

    if (recommendation.topContact.id && (!recommendation.topContact.expertise_tags || !recommendation.topContact.technology_tags || !recommendation.topContact.activity_signals)) {
      const { data: profile } = await supabase
        .from("connection_profiles")
        .select("location, expertise_tags, technology_tags, activity_signals")
        .eq("connection_id", recommendation.topContact.id)
        .maybeSingle();

      if (profile) {
        recommendation.topContact.location = recommendation.topContact.location || profile.location;
        recommendation.topContact.expertise_tags = recommendation.topContact.expertise_tags || profile.expertise_tags;
        recommendation.topContact.technology_tags = recommendation.topContact.technology_tags || profile.technology_tags;
        recommendation.topContact.activity_signals = recommendation.topContact.activity_signals || profile.activity_signals;
      }
    }

    const relationshipIntelligence = await evaluateRelationshipIntelligence({
      conversationSummary: recommendation.topContact.conversation_summary,
      discussionTopics: recommendation.topContact.discussion_topics,
      interactionTimeline: recommendation.topContact.interaction_timeline,
      recentHighlights: recommendation.topContact.recent_highlights,
      messageCount: recommendation.topContact.total_messages ?? undefined,
      lastInteractionDate: recommendation.topContact.last_interaction_date,
      relationshipScore: recommendation.topContact.relationship_score?.toString(),
      relationshipClassification: recommendation.topContact.relationship_classification,
      connectionOwnerName: recommendation.topContact.connection_owner_name,
      engagementQuality: recommendation.topContact.engagement_quality,
    });

    const companyContext = await getCompanyContext(supabase, recommendation.company);

    const { data: cacheRow } = await supabase
      .from("company_industry_cache")
      .select("industry")
      .eq("user_id", user.id)
      .ilike("company_name", recommendation.company)
      .maybeSingle();
      
    const industry = cacheRow?.industry && cacheRow.industry !== "Unknown" ? cacheRow.industry : "";

    const enhancedQueryParts = [];
    if (companyContext) {
       if (companyContext.technologySignals?.length) enhancedQueryParts.push(companyContext.technologySignals.join(" "));
       if (companyContext.businessPriorities?.length) enhancedQueryParts.push(companyContext.businessPriorities.join(" "));
       if (companyContext.keyInitiatives?.length) enhancedQueryParts.push(companyContext.keyInitiatives.join(" "));
       if (companyContext.outreachOpportunities?.length) enhancedQueryParts.push(companyContext.outreachOpportunities.join(" "));
    }
    if (recommendation.topContact.discussion_topics) enhancedQueryParts.push(recommendation.topContact.discussion_topics);
    if (recommendation.topContact.conversation_summary) enhancedQueryParts.push(recommendation.topContact.conversation_summary);
    
    if (recommendation.topContact.position) enhancedQueryParts.push(recommendation.topContact.position);
    if (industry) enhancedQueryParts.push(industry);
    enhancedQueryParts.push(recommendation.company);

    const enhancedQuery = enhancedQueryParts.join(" ").trim();
    let emailProjects = matchingProjects;
    if (enhancedQuery) {
      const freshProjects = await searchKnowledgeChunks(supabase, user.id, enhancedQuery, 3);
      // console.log("[EMAIL_GENERATION] Fresh Retrieval Projects:", freshProjects.map(p => p.project_name || p.document_id));
      
      if (freshProjects.length > 0) {
        emailProjects = freshProjects;
        // console.log("[EMAIL_GENERATION] Project Source: enhanced_retrieval");
      } else {
        // console.log("[EMAIL_GENERATION] Project Source: dashboard_fallback_due_to_empty_fresh");
      }
    } else {
      // console.log("[EMAIL_GENERATION] Project Source: dashboard_fallback_due_to_empty_query");
    }

    // console.log("[EMAIL_GENERATION] Projects Used:", emailProjects.map(p => p.project_name || p.document_id));

    const emailContent = await generateOutreachEmail({
      targetCompany: recommendation.company,
      contact: recommendation.topContact,
      projects: emailProjects,
      recommendationReason: recommendation.suggestedReason,
      relationshipIntelligence,
      provider: parsed.data.provider ?? undefined,
      model: parsed.data.model ?? undefined,
    });

    const contactName = [
      recommendation.topContact.first_name,
      recommendation.topContact.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const { data: savedEmail, error: emailError } = await supabase
      .from("generated_emails")
      .insert({
        user_id: user.id,
        company_name: recommendation.company,
        contact_name: contactName || null,
        subject: emailContent.subject,
        body: emailContent.body,
        provider_used: parsed.data.provider ?? "gemini",
        relationship_type: relationshipIntelligence.relationshipType,
        generation_context: {
          relationship_intelligence: {
            relationshipType: relationshipIntelligence.relationshipType,
            confidence: relationshipIntelligence.confidence,
            reasoning: relationshipIntelligence.reasoning,
            outreachGoal: relationshipIntelligence.outreachGoal,
            capabilityProminence: relationshipIntelligence.capabilityProminence,
          },
          company_context_relevance: null,
          company_context: companyContext ? {
            summary: companyContext.summary,
            keyInitiatives: companyContext.keyInitiatives,
            technologySignals: companyContext.technologySignals,
            businessPriorities: companyContext.businessPriorities,
          } : null,
        },
      })
      .select()
      .single();

    if (emailError) throw emailError;

    return NextResponse.json({
      contact: recommendation.topContact,
      projects: emailProjects.map((p) => ({
        ...p,
        summary: p.chunk_text?.slice(0, 200),
      })),
      email: savedEmail,
      recommendation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Outreach failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
