import { NextResponse } from "next/server";
import { emailGenerateSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";
import { generateOutreachEmail } from "@/domains/emails/services/emailGenerator";
import { getRecommendationForEmail } from "@/domains/prospects/services/prospectRecommendation";
import { searchKnowledgeChunks } from "@/infrastructure/vector-store/vectorSearch";
import { getCompanyContext } from "@/domains/companies/services/companyContextIntelligence";
import { evaluateCompanyContextRelevance } from "@/domains/companies/services/companyContextRelevance";
import { evaluateRelationshipIntelligence } from "@/domains/connections/services/relationshipIntelligence";
import type { MatchedChunk, RankedContact } from "@/types/database";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    // TEMPORARY LOGGING: Inspect the full payload before schema validation

    const parsed = emailGenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }
    const supabase = await createClient();
    let contact: RankedContact;
    let projects: MatchedChunk[];
    let recommendationReason = parsed.data.recommendation_reason;
    const recContext = await getRecommendationForEmail(
      supabase,
      user.id,
      parsed.data.company_name
    );

    if (parsed.data.projects?.length) {
      projects = parsed.data.projects as MatchedChunk[];
      contact = {
        id: parsed.data.contact_id ?? "",
        first_name: parsed.data.contact_name?.split(" ")[0] ?? null,
        last_name:
          parsed.data.contact_name?.split(" ").slice(1).join(" ") ?? null,
        company: parsed.data.company_name,
        position: parsed.data.position ?? null,
        email: parsed.data.email ?? null,
        profile_url: parsed.data.profile_url ?? null,
        score: 0,
        conversation_summary: parsed.data.conversation_summary,
        discussion_topics: parsed.data.discussion_topics,
        interaction_timeline: parsed.data.interaction_timeline,
        recent_highlights: parsed.data.recent_highlights,
        total_messages: parsed.data.total_messages ?? undefined,
        last_interaction_date: parsed.data.last_interaction_date,
        connection_owner_name: parsed.data.connection_owner_name ?? undefined,
        key_interests: parsed.data.key_interests,
        business_context: parsed.data.business_context,
        action_items: parsed.data.action_items,
        engagement_quality: parsed.data.engagement_quality,
        recommended_outreach_angle: parsed.data.recommended_outreach_angle,
        personalization_points: parsed.data.personalization_points,
        persistent_context: parsed.data.persistent_context,
        time_bound_context: parsed.data.time_bound_context,
        location: parsed.data.location ?? null,
        expertise_tags: parsed.data.expertise_tags ?? null,
        technology_tags: parsed.data.technology_tags ?? null,
        activity_signals: parsed.data.activity_signals ?? null,
      };
    } else if (recContext.recommendation?.topContact) {
      contact = recContext.recommendation.topContact;
      projects = recContext.matchingProjects;
      recommendationReason ??= recContext.recommendation.suggestedReason;
    } else {
      contact = {
        id: "",
        first_name: parsed.data.contact_name?.split(" ")[0] ?? null,
        last_name:
          parsed.data.contact_name?.split(" ").slice(1).join(" ") ?? null,
        company: parsed.data.company_name,
        position: parsed.data.position ?? null,
        email: parsed.data.email ?? null,
        profile_url: parsed.data.profile_url ?? null,
        score: 0,
      };
      projects = [];
    }

    // Attempt to fetch profile intelligence if not provided but we have an ID
    if (contact.id && (!contact.expertise_tags || !contact.technology_tags || !contact.activity_signals)) {
      const { data: profile } = await supabase
        .from("connection_profiles")
        .select("location, expertise_tags, technology_tags, activity_signals")
        .eq("connection_id", contact.id)
        .maybeSingle();

      if (profile) {
        contact.location = contact.location || profile.location;
        contact.expertise_tags = contact.expertise_tags || profile.expertise_tags;
        contact.technology_tags = contact.technology_tags || profile.technology_tags;
        contact.activity_signals = contact.activity_signals || profile.activity_signals;
      }
    }

    const resolvedCompany = contact?.company || parsed.data.company_name;

    const companyContext = await getCompanyContext(supabase, resolvedCompany);

    let companyContextRelevance = null;
    if (companyContext) {
      companyContextRelevance = await evaluateCompanyContextRelevance({
        conversationSummary: contact?.conversation_summary,
        discussionTopics: contact?.discussion_topics,
        companyContext,
        relationshipMetadata: {
          lastContactDate: contact?.last_interaction_date,
          totalMessages: contact?.total_messages,
          daysSinceLastInteraction: contact?.last_interaction_date ? Math.floor((new Date().getTime() - new Date(contact.last_interaction_date).getTime()) / (1000 * 3600 * 24)) : null,
          relationshipStrength: contact?.relationship_score?.toString(),
          relationshipClassification: contact?.relationship_classification,
        }
      });
    }

    const relationshipIntelligence = await evaluateRelationshipIntelligence({
      conversationSummary: contact?.conversation_summary,
      discussionTopics: contact?.discussion_topics,
      interactionTimeline: contact?.interaction_timeline,
      recentHighlights: contact?.recent_highlights,
      messageCount: contact?.total_messages,
      lastInteractionDate: contact?.last_interaction_date,
      relationshipScore: contact?.relationship_score?.toString(),
      relationshipClassification: contact?.relationship_classification,
      connectionOwnerName: contact?.connection_owner_name,
      engagementQuality: contact?.engagement_quality,
    });


    const emailContent = await generateOutreachEmail({
      targetCompany: resolvedCompany,
      contact,
      projects,
      recommendationReason: recommendationReason ?? undefined,
      relationshipIntelligence,
      provider: parsed.data.provider ?? undefined,
      model: parsed.data.model ?? undefined,
      relationshipSummary: contact?.conversation_summary ?? undefined,
      discussionTopics: contact?.discussion_topics ?? undefined,
      recentHighlights: contact?.recent_highlights ?? undefined,
      interactionTimeline: contact?.interaction_timeline ?? undefined,
      messageCount: contact?.total_messages ?? undefined,
      lastInteractionDate: contact?.last_interaction_date ?? undefined,
      connectionOwnerName: contact?.connection_owner_name ?? undefined,
      keyInterests: contact?.key_interests ?? undefined,
      businessContext: contact?.business_context ?? undefined,
      actionItems: contact?.action_items ?? undefined,
      engagementQuality: contact?.engagement_quality ?? undefined,
      recommendedOutreachAngle: contact?.recommended_outreach_angle ?? undefined,
      personalizationPoints: contact?.personalization_points ?? undefined,
      persistentContext: contact?.persistent_context ?? undefined,
      timeBoundContext: contact?.time_bound_context ?? undefined,
      companyContext,
      companyContextRelevance,
    });

    const { data: saved, error } = await supabase
      .from("generated_emails")
      .insert({
        user_id: user.id,
        company_name: resolvedCompany,
        contact_name: parsed.data.contact_name ?? null,
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
          company_context_relevance: companyContextRelevance ? {
            relevanceScore: companyContextRelevance.relevanceScore,
            recommendedUsage: companyContextRelevance.recommendedUsage,
            reasoning: companyContextRelevance.reasoning,
          } : null,
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

    if (error) throw error;

    return NextResponse.json({
      email: saved,
      companyContext,
      companyContextRelevance,
      relationshipIntelligence,
      projects: projects.map((p) => ({
        ...p,
        summary: p.chunk_text?.slice(0, 200),
      }))
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
