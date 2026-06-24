import { createAdminClient } from '@/infrastructure/database/supabase/admin';
import type { CRMIntelligence } from '@/types/database';
import { generateWithFallback } from '@/services/ai/generation/generation';

export async function processCRMIntelligence(userId: string, connectionId: string) {
  const supabase = createAdminClient();

  // 1. Get ALL Bigin mappings for this connection
  const { data: mappings } = await supabase
    .from('bigin_contact_mapping')
    .select('bigin_contact_id')
    .eq('connection_id', connectionId);

  if (!mappings || mappings.length === 0) return null; // No CRM mapping

  const contactIds = mappings.map((m: any) => m.bigin_contact_id);

  console.log(`[CRM DIAGNOSTICS] Connection ${connectionId} is mapped to Bigin IDs:`, contactIds);

  // 2. Fetch related data from cache
  const [
    { data: rawDeals },
    { data: rawNotes },
    { data: rawTasks },
    { data: rawEvents },
    { data: rawCalls }
  ] = await Promise.all([
    supabase.from('bigin_raw_cache').select('data').eq('module_name', 'Deals').eq('user_id', userId),
    supabase.from('bigin_raw_cache').select('data').eq('module_name', 'Notes').eq('user_id', userId),
    supabase.from('bigin_raw_cache').select('data').eq('module_name', 'Tasks').eq('user_id', userId),
    supabase.from('bigin_raw_cache').select('data').eq('module_name', 'Events').eq('user_id', userId),
    supabase.from('bigin_raw_cache').select('data').eq('module_name', 'Calls').eq('user_id', userId)
  ]);

  const allRawDeals = rawDeals || [];
  const allRawNotes = rawNotes || [];
  const allRawTasks = rawTasks || [];
  const allRawEvents = rawEvents || [];
  const allRawCalls = rawCalls || [];

  // FIRST ORDER: Matches directly to contactIds
  const contactDeals = allRawDeals.filter((d: any) => {
    const contactNameId = d.data?.Contact_Name?.id;
    return contactIds.includes(contactNameId);
  }).map((d: any) => d.data);

  const dealIds = contactDeals.map((d: any) => d.id);

  // Filter helper that supports polymorphic relationships to Contact OR Deal
  const filterActivitiesAndNotes = (items: any[]) => {
    return items.filter(item => {
      const data = item.data;
      const contactNameId = data.Contact_Name?.id;
      const whoId = data.Who_Id?.id;
      const whatId = data.What_Id?.id;
      const parentId = data.Parent_Id?.id;
      const relatedId = data.Related_To?.id;
      const relatedModule = data['$related_module'];

      // Is it linked to one of the Contact IDs?
      const linkedToContact = contactIds.some((cId: string) =>
        contactNameId === cId ||
        whoId === cId ||
        parentId === cId ||
        (relatedId === cId && (relatedModule === 'Contacts' || !relatedModule))
      );

      // Is it linked to one of the Deal IDs? (Second-order traversal)
      const linkedToDeal = dealIds.some((dId: string) =>
        whatId === dId ||
        parentId === dId ||
        (relatedId === dId && (relatedModule === 'Deals' || relatedModule === 'Pipelines' || !relatedModule))
      );

      return linkedToContact || linkedToDeal;
    }).map((item: any) => item.data);
  };

  const matchedNotes = filterActivitiesAndNotes(allRawNotes);
  const matchedTasks = filterActivitiesAndNotes(allRawTasks);
  const matchedEvents = filterActivitiesAndNotes(allRawEvents);
  const matchedCalls = filterActivitiesAndNotes(allRawCalls);

  console.log(`[CRM DIAGNOSTICS] Connection ${connectionId} matched Deals: ${contactDeals.length}, Notes: ${matchedNotes.length}, Tasks: ${matchedTasks.length}, Calls: ${matchedCalls.length}, Events: ${matchedEvents.length}`);

  // 3. Build Deterministic Base Context
  const activeDeals = contactDeals.filter(d => !['Closed Won', 'Closed Lost'].includes(d.Stage));

  const sortedActivities = [...matchedTasks, ...matchedEvents, ...matchedCalls].sort((a, b) => {
    const d1 = new Date(a.Created_Time || a.Start_DateTime || a.Call_Start_Time || 0).getTime();
    const d2 = new Date(b.Created_Time || b.Start_DateTime || b.Call_Start_Time || 0).getTime();
    return d2 - d1;
  });

  const lastInteractionDate = sortedActivities.length > 0
    ? (sortedActivities[0].Created_Time || sortedActivities[0].Start_DateTime || sortedActivities[0].Call_Start_Time)
    : null;

  const lastMeeting = matchedEvents.length > 0
    ? matchedEvents.sort((a, b) => new Date(b.Start_DateTime || 0).getTime() - new Date(a.Start_DateTime || 0).getTime())[0].Event_Title
    : null;

  let baseRelationshipStage = 'Lead';
  if (activeDeals.length > 0) baseRelationshipStage = 'Active Opportunity';
  else if (contactDeals.length > 0) baseRelationshipStage = 'Past Opportunity';
  else if (matchedCalls.length > 0 || matchedEvents.length > 0) baseRelationshipStage = 'Engaged Lead';

  // Deterministic Signal Extraction
  const textCorpus = [
    ...matchedNotes.map(n => `${n.Note_Title || ''} ${n.Note_Content || ''}`),
    ...matchedCalls.map(c => `${c.Subject || ''} ${c.Description || ''}`)
  ].join(" ").toLowerCase();

  const extractedBuyingSignals = new Set<string>();
  const extractedObjections = new Set<string>();

  // Buying Signals
  if (/\b(sow|statement of work)\b/.test(textCorpus)) extractedBuyingSignals.add("SOW creation");
  if (/\b(sme|subject matter expert)\b/.test(textCorpus)) extractedBuyingSignals.add("SME involvement");
  if (/\b(internal follow.?up|follow.?up internally)\b/.test(textCorpus)) extractedBuyingSignals.add("Internal follow-up");
  if (/\b(procurement)\b/.test(textCorpus)) extractedBuyingSignals.add("Procurement discussion");
  if (/\b(msa|master service agreement)\b/.test(textCorpus)) extractedBuyingSignals.add("MSA discussion");
  if (/\b(pilot)\b/.test(textCorpus)) extractedBuyingSignals.add("Pilot project discussion");
  if (/\b(budget)\b/.test(textCorpus)) extractedBuyingSignals.add("Budget discussion");

  // Objections
  if (/\b(poc|proof of concept)\b/.test(textCorpus)) extractedObjections.add("Requires POC");
  if (/\b(closed.?circuit)\b/.test(textCorpus)) extractedObjections.add("Closed-circuit evaluation");
  if (/\b(procurement blocker|blocked by procurement)\b/.test(textCorpus)) extractedObjections.add("Procurement blockers");
  if (/\b(budget constraint|no budget|budget issue|too expensive)\b/.test(textCorpus)) extractedObjections.add("Budget constraints");
  if (/\b(resource constraint|no resources|bandwidth|no time)\b/.test(textCorpus)) extractedObjections.add("Resource constraints");
  if (/\b(security concern|security issue|infosec|compliance)\b/.test(textCorpus)) extractedObjections.add("Security concerns");

  // Initialize CRM context with ALL known raw data
  const crmContext: CRMIntelligence = {
    relationshipStage: baseRelationshipStage,
    lastMeeting,
    lastInteractionDate,
    activeDeals: contactDeals.map((d: any) => ({ name: d.Deal_Name || d.Pipeline_Name, stage: d.Stage, amount: d.Amount })),
    notes: matchedNotes.map((n: any) => ({ content: n.Note_Content, date: n.Created_Time })),
    callSummaries: matchedCalls.map((c: any) => ({ subject: c.Subject, result: c.Call_Result, description: c.Description, date: c.Call_Start_Time })),
    buyingSignals: Array.from(extractedBuyingSignals),
    objections: Array.from(extractedObjections),
    followUps: matchedTasks.filter(t => t.Status !== 'Completed').map(t => t.Subject)
  };

  let crmSummary = "";

  // 4. AI Generation
  const aiPrompt = `You are a CRM intelligence analyst evaluating raw activity data for a B2B connection.
Generate a structured CRM summary focusing on relationship intelligence rather than raw record dumps.

Raw Data:
Deals: ${JSON.stringify(crmContext.activeDeals)}
Tasks: ${JSON.stringify(matchedTasks.map(t => ({ subject: t.Subject, status: t.Status, due: t.Due_Date })))}
Calls: ${JSON.stringify(crmContext.callSummaries)}
Notes: ${JSON.stringify(crmContext.notes)}
Events: ${JSON.stringify(matchedEvents.map(e => ({ title: e.Event_Title, date: e.Start_DateTime })))}

Respond in JSON only with exactly this structure:
{
  "relationshipStage": "Lead | Warm Lead | Active Opportunity | Customer | Dormant Contact",
  "lastInteraction": {
    "date": "YYYY-MM-DD or Unknown",
    "type": "Call | Email | Note | Task | Meeting | Unknown",
    "shortDescription": "Brief summary of the last interaction"
  },
  "opportunities": [{"dealName": "name", "stage": "stage", "amount": "amount"}],
  "buyingSignals": ["signal 1", "signal 2"],
  "objections": ["objection 1", "objection 2"],
  "openFollowUps": ["action item 1", "action item 2"],
  "recommendedFollowUp": "1 sentence recommending the best angle for the next outreach email based on the CRM history."
}`;

  try {
    const aiResult = await generateWithFallback(aiPrompt, "CRM_INTELLIGENCE_SUMMARY", { isJson: true });
    const structuredSummary = JSON.parse(aiResult.text);

    // Update Context with AI enriched data
    crmContext.relationshipStage = structuredSummary.relationshipStage || baseRelationshipStage;
    if (structuredSummary.buyingSignals) {
      crmContext.buyingSignals = Array.from(new Set([...(crmContext.buyingSignals || []), ...structuredSummary.buyingSignals]));
    }
    if (structuredSummary.objections) {
      crmContext.objections = Array.from(new Set([...(crmContext.objections || []), ...structuredSummary.objections]));
    }
    if (structuredSummary.openFollowUps && structuredSummary.openFollowUps.length > 0) {
      // Merge deterministic tasks with AI extracted next actions
      crmContext.followUps = Array.from(new Set([...(crmContext.followUps || []), ...structuredSummary.openFollowUps]));
    }

    // Build the string representation for crm_summary
    const summaryLines = [
      `Relationship Stage: ${structuredSummary.relationshipStage}`,
      `Last Interaction: ${structuredSummary.lastInteraction?.date || 'Unknown'} (${structuredSummary.lastInteraction?.type || 'Unknown'}) - ${structuredSummary.lastInteraction?.shortDescription || 'No description available'}`,
      `Opportunities: ${(structuredSummary.opportunities || []).length > 0 ? structuredSummary.opportunities.map((o: any) => `${o.dealName} (${o.stage}, ${o.amount || 'Unknown amount'})`).join(', ') : 'None'}`,
      `Buying Signals: ${(structuredSummary.buyingSignals || []).length > 0 ? structuredSummary.buyingSignals.join(', ') : 'None'}`,
      `Objections: ${(structuredSummary.objections || []).length > 0 ? structuredSummary.objections.join(', ') : 'None'}`,
      `Open Follow Ups: ${(structuredSummary.openFollowUps || []).length > 0 ? structuredSummary.openFollowUps.join(', ') : 'None'}`,
      '',
      `Recommended Follow-Up:`,
      structuredSummary.recommendedFollowUp || 'No guidance available.'
    ];

    crmSummary = summaryLines.join('\n');
  } catch (error) {
    console.error(`[CRM] Failed to generate AI summary for connection ${connectionId}. Generating deterministic fallback. Error:`, error);

    // Deterministic Fallback
    const summaryLines = [
      `Relationship Stage: ${crmContext.relationshipStage}`,
      `Last Interaction: ${crmContext.lastInteractionDate || 'Unknown'}`,
      `Opportunities: ${(crmContext.activeDeals || []).length > 0 ? crmContext.activeDeals?.map(d => `${d.name} (${d.stage}, ${d.amount || 'Unknown amount'})`).join(', ') : 'None'}`,
      `Buying Signals: ${(crmContext.buyingSignals || []).length > 0 ? crmContext.buyingSignals?.join(', ') : 'None'}`,
      `Objections: ${(crmContext.objections || []).length > 0 ? crmContext.objections?.join(', ') : 'None'}`,
      `Open Follow Ups: ${(crmContext.followUps || []).length > 0 ? crmContext.followUps?.join(', ') : 'None'}`,
      '',
      `Recommended Follow-Up:`,
      `Review recent notes and tasks to determine next steps.`
    ];

    crmSummary = summaryLines.join('\n');
  }

  // 5. Update metrics
  await supabase.from('connection_relationship_metrics').upsert({
    connection_id: connectionId,
    user_id: userId,
    crm_context: crmContext,
    crm_summary: crmSummary || null,
    last_crm_sync: new Date().toISOString()
  }, { onConflict: 'connection_id' });

  return {
    crmContext,
    crmSummary
  };
}
