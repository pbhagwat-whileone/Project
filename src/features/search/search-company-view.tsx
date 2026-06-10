"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Mail, Search, Loader2, Settings2, UserPlus, Sparkles, BookOpen, Send, MapPin, Building, Activity, Copy, Check, Navigation, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmailEditor, formatEmailBodyToHtml } from "@/components/ui/email-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import type { GeneratedEmail, MatchedChunk, RankedContact, CompanyContext, CompanyContextRelevance, RelationshipIntelligence } from "@/types/database";
import { PROVIDER_MODELS, PROVIDERS, type ProviderType } from "@/ai/models";

type SearchResult = {
  contacts: RankedContact[];
  projects: (MatchedChunk & { summary?: string })[];
  message: string | null;
};

export function SearchCompanyView() {
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedContact, setSelectedContact] = useState<RankedContact | null>(null);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [summarizing, setSummarizing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [emailDialog, setEmailDialog] = useState<GeneratedEmail | null>(null);
  const [emailDialogCompanyContext, setEmailDialogCompanyContext] = useState<CompanyContext | null>(null);
  const [emailDialogCompanyContextRelevance, setEmailDialogCompanyContextRelevance] = useState<CompanyContextRelevance | null>(null);
  const [emailDialogRelationshipIntelligence, setEmailDialogRelationshipIntelligence] = useState<RelationshipIntelligence | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");

  const [relationshipType, setRelationshipType] = useState("Cold Outreach");
  const [provider, setProvider] = useState<ProviderType>("gemini");
  const [model, setModel] = useState<string>("gemini-2.5-pro");

  const [refinementInstruction, setRefinementInstruction] = useState("");
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    const savedProvider = localStorage.getItem("preferred_provider") as ProviderType;
    const savedModel = localStorage.getItem("preferred_model");
    if (savedProvider && PROVIDER_MODELS[savedProvider]) {
      setProvider(savedProvider);
      if (savedModel && PROVIDER_MODELS[savedProvider].includes(savedModel)) {
        setModel(savedModel);
      } else {
        const fallbackModel = PROVIDER_MODELS[savedProvider][0];
        setModel(fallbackModel);
        localStorage.setItem("preferred_model", fallbackModel);
      }
    }
  }, []);

  const handleProviderChange = (newProvider: ProviderType) => {
    setProvider(newProvider);
    const newModel = PROVIDER_MODELS[newProvider][0];
    setModel(newModel);
    localStorage.setItem("preferred_provider", newProvider);
    localStorage.setItem("preferred_model", newModel);
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    localStorage.setItem("preferred_model", newModel);
  };

  useEffect(() => {
    const companyParam = searchParams.get("company");
    if (companyParam && !hasAutoSearched) {
      setHasAutoSearched(true);
      setCompany(companyParam);
      // We can't use handleSearch directly since it expects a FormEvent.
      // So we trigger the same logic.
      const runSearch = async () => {
        setLoading(true);
        setResult(null);
        try {
          const data = await apiFetch<SearchResult>("/api/search/company", {
            method: "POST",
            body: JSON.stringify({ company: companyParam.trim() }),
          });
          setResult(data);
          const contactParam = searchParams.get("contact");
          let targetContact = data.contacts?.[0] || null;
          if (contactParam && data.contacts) {
            const found = data.contacts.find(c => c.id === contactParam);
            if (found) targetContact = found;
          }

          if (targetContact) {
            setSelectedContact(targetContact);
            if (targetContact.relationship_classification) {
              setRelationshipType(targetContact.relationship_classification);
            }
          } else {
            setSelectedContact(null);
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Search failed");
        } finally {
          setLoading(false);
        }
      };
      runSearch();
    }
  }, [searchParams, hasAutoSearched]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;

    router.replace(`?company=${encodeURIComponent(company.trim())}`, { scroll: false });
    setHasAutoSearched(true); // Prevent useEffect from re-triggering search

    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch<SearchResult>("/api/search/company", {
        method: "POST",
        body: JSON.stringify({ company: company.trim() }),
      });
      setResult(data);
      if (data.contacts && data.contacts.length > 0) {
        setSelectedContact(data.contacts[0]);
        router.replace(`?company=${encodeURIComponent(company.trim())}&contact=${data.contacts[0].id}`, { scroll: false });
      } else {
        setSelectedContact(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  const handleSelectContact = (contact: RankedContact) => {
    setSelectedContact(contact);
    const currentCompany = searchParams.get("company") || company;
    if (currentCompany) {
      router.replace(`?company=${encodeURIComponent(currentCompany)}&contact=${contact.id}`, { scroll: false });
    }
  };

  async function handleGenerateEmail() {
    if (!selectedContact) return;
    setGenerating(true);
    try {
      const contactName = [
        selectedContact.first_name,
        selectedContact.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      const data = await apiFetch<{ email: GeneratedEmail, companyContext?: CompanyContext, companyContextRelevance?: CompanyContextRelevance, relationshipIntelligence?: RelationshipIntelligence }>(
        "/api/emails/generate",
        {
          method: "POST",
          body: JSON.stringify({
            company_name: company,
            contact_name: contactName,
            position: selectedContact.position,
            email: selectedContact.email,
            profile_url: selectedContact.profile_url,
            projects: result?.projects || [],
            provider,
            model,
            conversation_summary: selectedContact.conversation_summary,
            discussion_topics: selectedContact.discussion_topics,
            interaction_timeline: selectedContact.interaction_timeline,
            recent_highlights: selectedContact.recent_highlights,
            total_messages: selectedContact.total_messages,
            last_interaction_date: selectedContact.last_interaction_date,
            connection_owner_name: selectedContact.connection_owner_name,
            key_interests: selectedContact.key_interests,
            business_context: selectedContact.business_context,
            action_items: selectedContact.action_items,
            engagement_quality: selectedContact.engagement_quality,
            recommended_outreach_angle: selectedContact.recommended_outreach_angle,
            personalization_points: selectedContact.personalization_points,
          }),
        }
      );
      setEditedSubject(data.email.subject);
      setEditedBody(data.email.body);
      setEmailDialog(data.email);
      setEmailDialogCompanyContext(data.companyContext || null);
      setEmailDialogCompanyContextRelevance(data.companyContextRelevance || null);
      setEmailDialogRelationshipIntelligence(data.relationshipIntelligence || null);
      toast.success("Email generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSummarize() {
    if (!selectedContact) return;
    setSummarizing(true);
    try {
      const data = await apiFetch<{ success: boolean, metrics: any }>(`/api/connections/${selectedContact.id}/summarize`, {
        method: "POST"
      });
      if (data.success && data.metrics) {
        toast.success("Conversation summarized successfully!");
        const updatedContact = {
          ...selectedContact,
          conversation_summary: data.metrics.conversation_summary,
          discussion_topics: data.metrics.discussion_topics,
          interaction_timeline: data.metrics.interaction_timeline,
          recent_highlights: data.metrics.recent_highlights,
          relationship_classification: data.metrics.relationship_classification,
        };
        setSelectedContact(updatedContact);
        if (data.metrics.relationship_classification) {
          setRelationshipType(data.metrics.relationship_classification);
        }
        // Also update in the result array
        if (result) {
          setResult({
            ...result,
            contacts: result.contacts.map(c => c.id === updatedContact.id ? updatedContact : c)
          });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Summarization failed");
    } finally {
      setSummarizing(false);
    }
  }

  async function handleRefine() {
    if (!emailDialog || !refinementInstruction.trim()) return;
    setRefining(true);
    try {
      const data = await apiFetch<{ email: GeneratedEmail }>(
        "/api/emails/refine",
        {
          method: "POST",
          body: JSON.stringify({
            email_id: emailDialog.id,
            current_subject: editedSubject,
            current_body: editedBody,
            instructions: refinementInstruction,
            provider,
            model,
            context: {
              company: selectedContact?.company || company,
              contactName: [selectedContact?.first_name, selectedContact?.last_name].filter(Boolean).join(" "),
              relationship: relationshipType,
            },
          }),
        }
      );
      setEditedSubject(data.email.subject);
      setEditedBody(data.email.body);
      setEmailDialog(data.email);
      setRefinementInstruction("");
      toast.success("Draft refined successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefining(false);
    }
  }

  async function copyEmail() {
    try {
      const plainText = `Subject: ${editedSubject}\n\n${editedBody.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')}`;
      const htmlText = `<p><strong>Subject:</strong> ${editedSubject}</p><br/>${formatEmailBodyToHtml(editedBody)}`;

      const blobHtml = new Blob([htmlText], { type: "text/html" });
      const blobText = new Blob([plainText], { type: "text/plain" });

      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText,
        })
      ]);
      toast.success("Copied to clipboard");
    } catch (err) {
      // Fallback
      navigator.clipboard.writeText(`Subject: ${editedSubject}\n\n${editedBody}`);
      toast.success("Copied to clipboard");
    }
  }

  return (
    <div>
      <PageHeader
        title="Search Company"
        description="Find the best LinkedIn connection and matching WhileOne projects."
      />

      <Card className="mb-8 max-w-xl">
        <CardHeader>
          <CardTitle>Company lookup</CardTitle>
          <CardDescription>
            Fuzzy-matches company names and ranks contacts by seniority.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="company" className="sr-only">
                Company Name
              </Label>
              <Input
                id="company"
                placeholder="e.g. Google, Acme Corp"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Analyzing company fit..." : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <>
          {selectedContact && result.message && (
            <div className="mb-6 p-4 rounded-md bg-blue-50 text-blue-800 text-sm border border-blue-200">
              {result.message}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recommended Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                {!result.contacts || result.contacts.length === 0 ? (
                  <p className="text-muted-foreground">
                    {result.message ?? "No connection found."}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {result.contacts.map((contact) => (
                      <div key={contact.id} className={`p-4 rounded-lg border ${selectedContact?.id === contact.id ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : ''}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              {[contact.first_name, contact.last_name].filter(Boolean).join(" ")}
                              {contact.profile_url && (
                                <a href={contact.profile_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">{contact.position ?? "—"}</div>
                            <div className="text-sm text-muted-foreground">{contact.company ?? "—"}</div>
                          </div>
                          <Button
                            variant={selectedContact?.id === contact.id ? "secondary" : "outline"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectContact(contact);
                            }}
                          >
                            {selectedContact?.id === contact.id ? "Selected" : "Select"}
                          </Button>
                        </div>

                        {(contact.relationship_score || 0) > 0 && (
                          <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Rel. Score</div>
                              <div className="font-medium">{contact.relationship_score}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Messages</div>
                              <div className="font-medium">{contact.total_messages || 0}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Last Contact</div>
                              <div className="font-medium">{contact.last_interaction_date ? new Date(contact.last_interaction_date).toLocaleDateString() : '—'}</div>
                            </div>
                          </div>
                        )}
                        {contact.conversation_summary && contact.conversation_summary !== "Failed to generate summary." && (
                          <div className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded border border-border/50">
                            <span className="font-semibold mb-1 block">AI Summary</span>
                            {contact.conversation_summary}
                          </div>
                        )}


                        {selectedContact?.id === contact.id && (
                          <div className="mt-3 flex flex-col gap-2">
                            {(contact.total_messages || 0) > 0 && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/connections?connection_id=${contact.id}`)}
                                  className="w-full justify-start"
                                >
                                  <Navigation className="h-4 w-4 mr-2" />
                                  View Conversation
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleSummarize}
                                  disabled={summarizing}
                                  className="w-full justify-start"
                                >
                                  <Activity className="h-4 w-4 mr-2" />
                                  {summarizing ? "Analyzing History..." : "Summarize Conversation"}
                                </Button>
                              </>
                            )}
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handleGenerateEmail}
                              disabled={generating}
                              className="w-full justify-start"
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Generate Outreach
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Matching Projects</CardTitle>
                <CardDescription>Top 3 semantic matches</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No matching projects in knowledge base.
                  </p>
                ) : (
                  result.projects.map((p) => (
                    <div key={p.id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          {p.project_name ?? "Project"}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {(p.similarity * 100).toFixed(0)}% match
                        </span>
                      </div>

                      {p.reference_link && (
                        <a
                          href={p.reference_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          Open Project Document
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {selectedContact && (
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="w-full sm:w-1/2">
                    <Label>AI Provider</Label>
                    <Select value={provider} onValueChange={(val) => handleProviderChange(val as ProviderType)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full sm:w-1/3">
                    <Label>AI Model</Label>
                    <Select value={model} onValueChange={handleModelChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_MODELS[provider]?.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleGenerateEmail} disabled={generating}>
                  <Mail className="mr-2 h-4 w-4" />
                  {generating ? "Generating personalized outreach..." : "Generate Outreach Email"}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={!!emailDialog} onOpenChange={() => setEmailDialog(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="body">Body</Label>
              <EmailEditor
                value={editedBody}
                onChange={setEditedBody}
              />
            </div>

            {emailDialogRelationshipIntelligence && (
              <details className="group border border-border/50 rounded-lg bg-muted/20">
                <summary className="flex items-center justify-between p-4 font-medium cursor-pointer list-none">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Relationship Intelligence</span>
                    <Badge variant="secondary" className="text-[10px] uppercase">Automatic</Badge>
                  </div>
                  <span className="transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="p-4 pt-0 border-t border-border/50 space-y-4 mt-4 text-sm">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-medium text-muted-foreground">Classification</span>
                      <Badge variant="outline">{emailDialogRelationshipIntelligence.relationshipType.replace(/-/g, " ")}</Badge>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-medium text-muted-foreground">Confidence</span>
                      <span>{emailDialogRelationshipIntelligence.confidence}%</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-medium text-muted-foreground">Outreach Goal</span>
                      <span className="uppercase text-xs font-semibold">{emailDialogRelationshipIntelligence.outreachGoal.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-medium text-muted-foreground">Capability Prominence</span>
                      <Badge variant={emailDialogRelationshipIntelligence.capabilityProminence === "high" ? "default" : "secondary"}>
                        {emailDialogRelationshipIntelligence.capabilityProminence.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="bg-background rounded border p-3 mt-4">
                    <span className="font-semibold block mb-1">AI Reasoning:</span>
                    <p className="text-muted-foreground italic">&ldquo;{emailDialogRelationshipIntelligence.reasoning}&rdquo;</p>
                  </div>
                </div>
              </details>
            )}

            {emailDialogCompanyContext && (
              <details className="group border border-border/50 rounded-lg bg-muted/20">
                <summary className="flex items-center justify-between p-4 font-medium cursor-pointer list-none">
                  <div className="flex items-center gap-2">
                    <span>Company Context</span>
                    <Badge variant="secondary" className="text-[10px]">Tavily API</Badge>
                  </div>
                  <span className="transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="p-4 pt-0 border-t border-border/50 space-y-4 mt-4 text-sm">
                  <p className="text-muted-foreground text-xs mb-4">
                    This intelligence was generated by AI using public information retrieved via the Tavily API.
                  </p>
                  
                  {emailDialogCompanyContextRelevance && (
                    <div className="bg-background rounded border p-3 mb-4">
                      <h4 className="font-semibold mb-2 flex items-center justify-between">
                        Relevance Evaluation
                        <Badge variant="outline" className={
                          emailDialogCompanyContextRelevance.recommendedUsage === "ignore" ? "border-destructive text-destructive" :
                          emailDialogCompanyContextRelevance.recommendedUsage === "primary_outreach_angle" ? "border-green-500 text-green-500" :
                          "border-yellow-500 text-yellow-500"
                        }>
                          {emailDialogCompanyContextRelevance.recommendedUsage.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                      </h4>
                      <p className="text-muted-foreground mb-2"><span className="font-medium">Score:</span> {emailDialogCompanyContextRelevance.relevanceScore}/100</p>
                      <p className="text-muted-foreground italic">&ldquo;{emailDialogCompanyContextRelevance.reasoning}&rdquo;</p>
                    </div>
                  )}

                  {emailDialogCompanyContext.summary && (
                    <div>
                      <h4 className="font-semibold mb-1">Summary</h4>
                      <p className="text-muted-foreground">{emailDialogCompanyContext.summary}</p>
                    </div>
                  )}

                  {emailDialogCompanyContext.keyInitiatives?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Key Initiatives</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {emailDialogCompanyContext.keyInitiatives.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {emailDialogCompanyContext.hiringSignals?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Hiring Signals</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {emailDialogCompanyContext.hiringSignals.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {emailDialogCompanyContext.technologySignals?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Technology Signals</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {emailDialogCompanyContext.technologySignals.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {emailDialogCompanyContext.businessPriorities?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Business Priorities</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {emailDialogCompanyContext.businessPriorities.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {emailDialogCompanyContext.outreachOpportunities?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Outreach Opportunities</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {emailDialogCompanyContext.outreachOpportunities.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {emailDialogCompanyContext.sources?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Sources</h4>
                      <ul className="pl-5 space-y-1 text-muted-foreground text-xs">
                        {emailDialogCompanyContext.sources.map((src, i) => (
                          <li key={i} className="list-disc">
                            <a href={src} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-500 truncate block max-w-[500px]">
                              {src}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <Label htmlFor="refine">Refine Draft</Label>
              <div className="flex gap-2">
                <Input
                  id="refine"
                  placeholder="e.g. Make it shorter, Sound more formal..."
                  value={refinementInstruction}
                  onChange={(e) => setRefinementInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRefine();
                  }}
                />
                <Button onClick={handleRefine} disabled={refining || !refinementInstruction.trim()}>
                  {refining ? "Refining..." : "Refine"}
                </Button>
              </div>
            </div>

            <Button onClick={copyEmail}>Copy to Clipboard</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
