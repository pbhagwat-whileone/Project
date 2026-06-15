"use client";

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, RefreshCw, Search, Send, Mail, Loader2, Settings2, UserPlus, Sparkles, BookOpen, MapPin, Building, Activity, Copy, Check, Navigation, Users, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import type {
  CompanyDetail,
  CompanyRecommendation,
} from "@/services/prospect-recommendation";
import type { GeneratedEmail, MatchedChunk, RankedContact, CompanyContext, CompanyContextRelevance, RelationshipIntelligence } from "@/types/database";
import { PROVIDER_MODELS, PROVIDERS, type ProviderType } from "@/ai/models";

type RankedRecommendation = CompanyRecommendation & { rank: number };

type SearchResult = {
  contacts: RankedContact[];
  projects: (MatchedChunk & { summary?: string })[];
  message: string | null;
};

export function CompaniesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // -- URL Parameter State --
  const activeCompanyParam = searchParams.get("company");
  const isSearchMode = !!activeCompanyParam;

  // -- Shared State --
  const [searchInput, setSearchInput] = useState("");

  // ==========================================
  // RECOMMENDATIONS STATE & LOGIC
  // ==========================================
  const [allRecommendations, setAllRecommendations] = useState<CompanyRecommendation[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [calculatedCount, setCalculatedCount] = useState(0);

  const loadRecommendations = useCallback(async () => {
    try {
      const data = await apiFetch<{
        recommendations: RankedRecommendation[];
      }>("/api/prospects");
      setAllRecommendations(data.recommendations);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load recommendations");
    } finally {
      setRecLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSearchMode) {
      loadRecommendations();
    }
  }, [isSearchMode, loadRecommendations]);

  async function handleRefresh() {
    setRefreshing(true);
    setAllRecommendations([]);
    setCachedCount(0);
    setCalculatedCount(0);

    try {
      const response = await fetch("/api/prospects/generate", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream found");
      
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let currentRecs: CompanyRecommendation[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const message = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          
          if (message.startsWith("data: ")) {
            const dataStr = message.slice(6);
            try {
              const event = JSON.parse(dataStr);
              if (event.type === "cached_batch") {
                const newRecs = event.data as CompanyRecommendation[];
                currentRecs = [...currentRecs, ...newRecs];
                setAllRecommendations(currentRecs);
                setCachedCount(prev => prev + newRecs.length);
              } else if (event.type === "calculated") {
                const newRec = event.data as CompanyRecommendation;
                currentRecs = [...currentRecs, newRec];
                setAllRecommendations(currentRecs);
                setCalculatedCount(prev => prev + 1);
              } else if (event.type === "error") {
                toast.error(event.data);
              }
            } catch (e) {
              console.error("Failed to parse SSE message", e);
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
      toast.success("Recommendation refresh completed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setRefreshing(false);
    }
  }

  const recommendations = useMemo(() => {
    let filtered = allRecommendations;

    if (searchInput && !isSearchMode) {
      const q = searchInput.toLowerCase();
      filtered = filtered.filter(
        (r) => r.company.toLowerCase().includes(q)
      );
    }

    return filtered
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .map((r, index) => ({
        ...r,
        rank: index + 1,
      }));
  }, [allRecommendations, searchInput, isSearchMode]);

  // ==========================================
  // SEARCH / CONTACT STATE & LOGIC
  // ==========================================
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [selectedContact, setSelectedContact] = useState<RankedContact | null>(null);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  const [similarContacts, setSimilarContacts] = useState<any[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [hasGeneratedCompanyContacts, setHasGeneratedCompanyContacts] = useState(false);
  const [contactProjectsLoading, setContactProjectsLoading] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [highlightedContactId, setHighlightedContactId] = useState<string | null>(null);
  const contactRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Email & Action State
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
    if (activeCompanyParam && !hasAutoSearched) {
      setHasAutoSearched(true);
      setSearchInput(activeCompanyParam);
      
      const runSearch = async () => {
        setSearchLoading(true);
        setSearchResult(null);
        try {
          const data = await apiFetch<SearchResult>("/api/search/company", {
            method: "POST",
            body: JSON.stringify({ company: activeCompanyParam.trim() }),
          });
          setSearchResult(data);
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
            
            // Set highlight and scroll
            setHighlightedContactId(targetContact.id);
            setTimeout(() => {
              contactRefs.current[targetContact.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
            setTimeout(() => {
              setHighlightedContactId(null);
            }, 3000);
            
          } else {
            setSelectedContact(null);
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Search failed");
        } finally {
          setSearchLoading(false);
        }
      };
      runSearch();
    } else if (!activeCompanyParam) {
      setHasAutoSearched(false);
      setSearchResult(null);
      setSelectedContact(null);
      if (searchInput === activeCompanyParam) {
        setSearchInput("");
      }
    }
  }, [activeCompanyParam, searchParams, hasAutoSearched, searchInput]);

  const handleGenerateCompanyContacts = async () => {
    if (!activeCompanyParam) return;
    setSimilarLoading(true);
    try {
      const data = await apiFetch<{ contacts: any[] }>("/api/search/company-similar-contacts", {
        method: "POST",
        body: JSON.stringify({
          company: activeCompanyParam,
        }),
      });
      setSimilarContacts(data.contacts || []);
      setHasGeneratedCompanyContacts(true);
    } catch (e) {
      console.error(e);
      setSimilarContacts([]);
    } finally {
      setSimilarLoading(false);
    }
  };

  useEffect(() => {
    setProjectsOpen(false);
    setSearchResult(prev => prev ? { ...prev, projects: [] } : null);
    // Similar contacts are no longer cleared automatically, they remain tied to the company view.
  }, [selectedContact]);

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!searchInput.trim()) return;

    router.push(`/companies?company=${encodeURIComponent(searchInput.trim())}`);
  }

  function handleCompanySelect(companyName: string) {
    setSearchInput(companyName);
    router.push(`/companies?company=${encodeURIComponent(companyName)}`);
  }

  function handleBackToRecommendations() {
    setSearchInput("");
    router.push("/companies");
  }

  const handleSelectContact = (contact: RankedContact) => {
    setSelectedContact(contact);
    if (activeCompanyParam) {
      router.replace(`?company=${encodeURIComponent(activeCompanyParam)}&contact=${contact.id}`, { scroll: false });
    }
  };

  // -- Action Handlers --
  async function handleGenerateProjects(contactId: string) {
    setContactProjectsLoading(true);
    try {
      const data = await apiFetch<{ projects: any[] }>(`/api/connections/${contactId}/projects`, {
        method: "POST"
      });
      
      // console.log("[ProjectMatching UI] Full Response:", data);
      // console.log("[ProjectMatching UI] Projects Received:", data.projects);

      // console.log("[ProjectMatching UI] Setting Projects:", data.projects);
      console.log("Projects in state (before update):", searchResult?.projects);
      console.log("Projects from API:", data.projects);
      setSearchResult(prev => prev ? {
        ...prev,
        projects: data.projects
      } : null);
      
      toast.success("Matching projects generated!");
      
      return data.projects;
    } catch (err) {
      toast.error("Failed to generate projects");
      return null;
    } finally {
      setContactProjectsLoading(false);
    }
  }

  async function handleGenerateEmail() {
    if (!selectedContact) return;
    setGenerating(true);
    try {
      let currentContact = selectedContact;
      let currentProjects = searchResult?.projects || [];

      if (!currentContact.conversation_summary) {
        toast.info("Generating conversation summary...");
        const sumData = await apiFetch<{ success: boolean, metrics: any }>(`/api/connections/${currentContact.id}/summarize`, { method: "POST" });
        if (sumData.success && sumData.metrics) {
          currentContact = {
             ...currentContact,
             conversation_summary: sumData.metrics.conversation_summary,
             discussion_topics: sumData.metrics.discussion_topics,
             interaction_timeline: sumData.metrics.interaction_timeline,
             recent_highlights: sumData.metrics.recent_highlights,
             relationship_classification: sumData.metrics.relationship_classification,
          };
          setSelectedContact(currentContact);
          if (sumData.metrics.relationship_classification) {
            setRelationshipType(sumData.metrics.relationship_classification);
          }
        }
      }

      if (currentProjects.length === 0) {
        toast.info("Generating matching projects...");
        const projData = await handleGenerateProjects(currentContact.id);
        if (projData) {
          currentProjects = projData;
        }
      }

      const contactName = [
        currentContact.first_name,
        currentContact.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      const data = await apiFetch<{ email: GeneratedEmail, companyContext?: CompanyContext, companyContextRelevance?: CompanyContextRelevance, relationshipIntelligence?: RelationshipIntelligence, projects?: (MatchedChunk & { summary?: string })[] }>(
        "/api/emails/generate",
        {
          method: "POST",
          body: JSON.stringify({
            company_name: currentContact.company || activeCompanyParam,
            contact_name: contactName,
            position: currentContact.position,
            email: currentContact.email,
            profile_url: currentContact.profile_url,
            projects: currentProjects,
            provider,
            model,
            conversation_summary: currentContact.conversation_summary,
            discussion_topics: currentContact.discussion_topics,
            interaction_timeline: currentContact.interaction_timeline,
            recent_highlights: currentContact.recent_highlights,
            total_messages: currentContact.total_messages,
            last_interaction_date: currentContact.last_interaction_date,
            connection_owner_name: currentContact.connection_owner_name,
            key_interests: currentContact.key_interests,
            business_context: currentContact.business_context,
            action_items: currentContact.action_items,
            engagement_quality: currentContact.engagement_quality,
            recommended_outreach_angle: currentContact.recommended_outreach_angle,
            personalization_points: currentContact.personalization_points,
          }),
        }
      );
      setEditedSubject(data.email.subject);
      setEditedBody(data.email.body);
      setEmailDialog(data.email);
      setEmailDialogCompanyContext(data.companyContext || null);
      setEmailDialogCompanyContextRelevance(data.companyContextRelevance || null);
      setEmailDialogRelationshipIntelligence(data.relationshipIntelligence || null);
      if (data.projects) {
        setSearchResult(prev => prev ? { ...prev, projects: data.projects! } : null);
      }
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
        if (searchResult) {
          setSearchResult({
            ...searchResult,
            contacts: searchResult.contacts.map(c => c.id === updatedContact.id ? updatedContact : c)
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
              company: selectedContact?.company || activeCompanyParam,
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
      navigator.clipboard.writeText(`Subject: ${editedSubject}\n\n${editedBody}`);
      toast.success("Copied to clipboard");
    }
  }

  // console.log("[ProjectMatching UI] Current Projects State:", searchResult?.projects);

  return (
    <div>
      <PageHeader
        title="Companies"
        description={isSearchMode ? `Exploring connections and context for ${activeCompanyParam}` : "AI-ranked outreach targets and company discovery."}
        action={
          !isSearchMode && (
            <div className="flex flex-col items-end gap-2">
              <Button onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Generating..." : "Refresh Recommendations"}
              </Button>
              {refreshing && (
                <div className="flex gap-2 text-xs font-medium">
                  <Badge variant="outline" className="bg-primary/10 animate-pulse">Cached: {cachedCount}</Badge>
                  <Badge variant="outline" className="bg-primary/10 animate-pulse">Calculated: {calculatedCount}</Badge>
                </div>
              )}
            </div>
          )
        }
      />

      {/* Top Search Bar */}
      <div className="mb-6 flex gap-4 items-center">
        {isSearchMode && (
          <Button variant="outline" size="icon" onClick={handleBackToRecommendations} title="Back to Recommendations">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={isSearchMode ? "Search another company..." : "Search company or filter recommendations..."}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isSearchMode && searchLoading}>
            {isSearchMode ? (searchLoading ? "Searching..." : "Search") : "Search Database"}
          </Button>
        </form>
      </div>

      {/* Conditional Rendering: Recommendations vs Search Results */}
      {!isSearchMode ? (
        // --- RECOMMENDATIONS VIEW ---
        <>
          {refreshing && allRecommendations.length === 0 ? (
            <LoadingSpinner label="Loading cached connections..." />
          ) : recLoading ? (
            <LoadingSpinner />
          ) : allRecommendations.length === 0 ? (
            <EmptyState
              title="No recommendations generated yet"
              description="Click Refresh Recommendations to generate recommendations."
            />
          ) : recommendations.length === 0 ? (
            <EmptyState
              title="No companies match the selected filters."
              description="Try adjusting your search or filter criteria."
            />
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Connections</TableHead>
                    <TableHead>Top Contact</TableHead>
                    <TableHead className="min-w-[200px]">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendations.map((rec) => (
                    <TableRow
                      key={rec.company}
                      className="cursor-pointer"
                      onClick={() => handleCompanySelect(rec.company)}
                    >
                      <TableCell className="font-medium">{rec.rank}</TableCell>
                      <TableCell className="font-medium">{rec.company}</TableCell>

                      <TableCell>
                        <Badge variant={rec.recommendationScore >= 70 ? "success" : "secondary"}>
                          {rec.recommendationScore} Match
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          {rec.connectionCount} {rec.connectionCount === 1 ? "Connection" : "Connections"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {rec.topContact?.position ? (
                          <span className="font-medium">{rec.topContact.position}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {rec.suggestedReason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : (
        // --- SEARCH / CONTACTS VIEW ---
        <>
          {searchLoading ? (
            <LoadingSpinner label={`Analyzing company fit for ${activeCompanyParam}...`} />
          ) : searchResult ? (
            <>
              {selectedContact && searchResult.message && (
                <div className="mb-6 p-4 rounded-md bg-blue-50 text-blue-800 text-sm border border-blue-200">
                  {searchResult.message}
                </div>
              )}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recommended Contacts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!searchResult.contacts || searchResult.contacts.length === 0 ? (
                      <p className="text-muted-foreground">
                        {searchResult.message ?? "No connection found."}
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {searchResult.contacts.map((contact) => (
                          <div 
                            key={contact.id} 
                            ref={(el) => {
                              if (el) contactRefs.current[contact.id] = el;
                            }}
                            className={`p-4 rounded-lg border ${selectedContact?.id === contact.id ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : ''} ${highlightedContactId === contact.id ? 'bg-primary/20 transition-colors duration-1000' : 'transition-colors duration-1000'}`}
                          >
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
                              <div className="flex flex-col gap-2">
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/connections?id=${contact.id}`);
                                  }}
                                  title="View Connection in Connections Page"
                                >
                                  <Users className="h-4 w-4 mr-2" />
                                  View Connection
                                </Button>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
                              <div><span className="font-medium text-foreground">Location:</span> {contact.location || "—"}</div>
                              <div><span className="font-medium text-foreground">Email:</span> {contact.email || "—"}</div>
                            </div>

                            {(contact.relationship_score || 0) > 0 && (
                              <div className="mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
                                <div>
                                  <div className="text-muted-foreground">Connected Through</div>
                                  <div className="font-medium">{contact.connection_owner_name || '—'}</div>
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
                                <details 
                                  className="group border border-border/50 rounded-lg bg-muted/10 w-full" 
                                  open={projectsOpen} 
                                  onToggle={async (e) => {
                                    const isOpen = e.currentTarget.open;
                                    setProjectsOpen(isOpen);
                                    if (isOpen && (!searchResult.projects || searchResult.projects.length === 0)) {
                                       await handleGenerateProjects(contact.id);
                                    }
                                  }}
                                >
                                  <summary className="flex items-center justify-between p-2 font-medium cursor-pointer list-none text-sm hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className="w-4 h-4 text-primary" />
                                      <span>{contactProjectsLoading ? "Generating..." : searchResult.projects?.length ? `Matching Projects (${searchResult.projects.length})` : "Generate Matching Projects"}</span>
                                    </div>
                                    <span className="transition-transform group-open:rotate-180 text-muted-foreground">▼</span>
                                  </summary>
                                  <div className="p-3 pt-0 border-t border-border/50 space-y-3 mt-3">
                                     {contactProjectsLoading ? (
                                        <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">Loading projects...</div>
                                     ) : searchResult.projects?.length ? (
                                        searchResult.projects.map(p => (
                                          <div key={p.id} className="text-sm bg-background p-3 rounded border border-border/50">
                                            <div className="font-medium flex justify-between items-start gap-4">
                                              <span>{p.project_name || "Project"}</span>
                                              {p.similarity !== undefined && (
                                                <span className={`text-xs shrink-0 px-2 py-1 rounded-full border font-medium ${p.similarity >= 0.75 ? "bg-green-50 text-green-700 border-green-200" : p.similarity >= 0.5 ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-gray-50 text-gray-700 border-gray-200"}`}>
                                                  {p.similarity >= 0.75 ? "High Match" : p.similarity >= 0.5 ? "Medium Match" : "Low Match"} <span className="opacity-75 font-normal">({(p.similarity * 100).toFixed(0)}%)</span>
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-muted-foreground mt-2 text-xs leading-relaxed line-clamp-3">{p.summary}</div>
                                            {p.reference_link && (
                                              <a href={p.reference_link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                                View Source <ExternalLink className="h-3 w-3" />
                                              </a>
                                            )}
                                          </div>
                                        ))
                                     ) : (
                                        <p className="text-xs text-muted-foreground">No projects found.</p>
                                     )}
                                  </div>
                                </details>
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
                    <CardTitle className="flex items-center justify-between">
                      Account Discovery
                      {!similarLoading && !hasGeneratedCompanyContacts && similarContacts.length === 0 && (
                        <Button variant="outline" size="sm" onClick={handleGenerateCompanyContacts}>
                          <Search className="h-4 w-4 mr-2" />
                          Find Missing Stakeholders
                        </Button>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Identify adjacent decision-makers at {activeCompanyParam} that you are not connected to.
                      <span className="block mt-1 text-orange-500/80 text-xs">
                        Warning: This action consumes Apollo credits. Results are cached for 30 days.
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {similarLoading ? (
                      <LoadingSpinner label="Analyzing account and discovering stakeholders..." />
                    ) : similarContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {hasGeneratedCompanyContacts 
                          ? "No additional unique stakeholders found." 
                          : "Click to generate net-new stakeholders at this company."}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {similarContacts.map((p, idx) => (
                          <div key={idx} className="rounded-lg border p-4 bg-background">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-sm">
                                {p.linkedin_url || (p as any).apollo_url ? (
                                  <a
                                    href={p.linkedin_url || (p as any).apollo_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                  >
                                    {p.name}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  p.name
                                )}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{p.position}</p>
                            <p className="text-sm text-muted-foreground">{p.company}</p>
                            {p.location && <p className="text-xs text-muted-foreground mt-2">Location: {p.location}</p>}
                          </div>
                        ))}
                      </div>
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
          ) : null}

          {/* Email Dialog */}
          <Dialog open={!!emailDialog} onOpenChange={() => setEmailDialog(null)}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Email</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted p-3 rounded-md text-sm border border-border/50">
                  <span className="font-medium">Recipient Email:</span> {selectedContact?.email || "—"}
                </div>
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
        </>
      )}
    </div>
  );
}
