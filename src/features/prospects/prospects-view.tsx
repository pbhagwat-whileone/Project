"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { ExternalLink, Mail, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import type {
  CompanyDetail,
  CompanyRecommendation,
} from "@/services/prospect-recommendation";
import type { GeneratedEmail } from "@/types/database";
import { PROVIDER_MODELS, type ProviderType } from "@/ai/models";

type RankedRecommendation = CompanyRecommendation & { rank: number };

export function ProspectsView() {
  const [allRecommendations, setAllRecommendations] = useState<RankedRecommendation[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  
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
        setModel(PROVIDER_MODELS[savedProvider][0]);
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

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{
        recommendations: RankedRecommendation[];
      }>("/api/prospects");

      setAllRecommendations(data.recommendations);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function openDetail(company: string) {
    setSelectedCompany(company);
    setDetail(null);
    setGeneratedEmail(null);
    setDetailLoading(true);
    try {
      const data = await apiFetch<{ detail: CompanyDetail }>(
        `/api/prospects/detail?company=${encodeURIComponent(company)}`
      );
      setDetail(data.detail);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load detail");
      setSelectedCompany(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function generateOutreach(company: string) {
    setGenerating(true);
    try {
      const data = await apiFetch<{ email: GeneratedEmail }>(
        "/api/prospects/outreach",
        {
          method: "POST",
          body: JSON.stringify({ 
            company_name: company,
            relationship_type: relationshipType,
            provider,
            model,
          }),
        }
      );
      setGeneratedEmail(data.email);
      setEditedSubject(data.email.subject);
      setEditedBody(data.email.body);
      toast.success("Outreach email generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRefine() {
    if (!generatedEmail || !refinementInstruction.trim() || !detail) return;
    setRefining(true);
    try {
      const data = await apiFetch<{ email: GeneratedEmail }>(
        "/api/emails/refine",
        {
          method: "POST",
          body: JSON.stringify({
            email_id: generatedEmail.id,
            current_subject: editedSubject,
            current_body: editedBody,
            instructions: refinementInstruction,
            provider,
            model,
            context: {
              company: detail.company,
              contactName: detail.topContact ? [detail.topContact.first_name, detail.topContact.last_name].filter(Boolean).join(" ") : "Unknown",
              relationship: relationshipType,
            },
          }),
        }
      );
      setEditedSubject(data.email.subject);
      setEditedBody(data.email.body);
      setGeneratedEmail(data.email);
      setRefinementInstruction("");
      toast.success("Draft refined successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefining(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const data = await apiFetch<{
        recommendations: RankedRecommendation[];
      }>("/api/prospects/generate", {
        method: "POST"
      });
      setAllRecommendations(data.recommendations);
      toast.success("Recommendations generated successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setRefreshing(false);
    }
  }

  const recommendations = useMemo(() => {
    let filtered = allRecommendations;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.company.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [allRecommendations, searchQuery]);

  return (
    <div>
      <PageHeader
        title="Recommended Companies"
        description="AI-ranked outreach targets based on project expertise and LinkedIn connections."
        action={
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Generating..." : "Refresh Recommendations"}
          </Button>
        }
      />



      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search company…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {refreshing ? (
        <LoadingSpinner label="Analyzing connection companies..." />
      ) : loading ? (
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
                  onClick={() => openDetail(rec.company)}
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

      <Dialog
        open={!!selectedCompany}
        onOpenChange={() => {
          setSelectedCompany(null);
          setDetail(null);
          setGeneratedEmail(null);
          setEditedSubject("");
          setEditedBody("");
          setRefinementInstruction("");
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail?.company ?? selectedCompany ?? "Company Detail"}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <LoadingSpinner label="Evaluating company opportunities..." />
          ) : detail ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 font-medium">Company Information</h4>
                  <dl className="space-y-1 text-sm">

                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Score</dt>
                      <dd>{detail.recommendationScore}/100</dd>
                    </div>

                  </dl>
                </div>

                <div>
                  <h4 className="mb-2 font-medium">
                    Connections ({detail.connections.length})
                  </h4>
                  <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
                    {detail.connections.map((c) => (
                      <li key={c.id} className="rounded border p-2">
                        <p className="font-medium">
                          {[c.first_name, c.last_name].filter(Boolean).join(" ")}
                        </p>
                        <p className="text-muted-foreground">{c.position}</p>
                        {c.profile_url && (
                          <a
                            href={c.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Profile
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 font-medium">Matching Projects</h4>
                  {detail.matchingProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No matching projects found.
                    </p>
                  ) : (
                    detail.matchingProjects.map((p) => (
                      <div key={p.id} className="mb-2 rounded border p-3 text-sm">
                        <div className="flex justify-between">
                          <p className="font-medium">
                            {p.project_name ?? "Project"}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {(p.similarity * 100).toFixed(0)}%
                          </span>
                        </div>

                        {p.reference_link && (
                          <a
                            href={p.reference_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open Project Document
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <h4 className="mb-2 font-medium">Outreach Recommendation</h4>
                  <p className="text-sm text-muted-foreground">
                    {detail.outreachRecommendation}
                  </p>
                </div>

                {generatedEmail ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Subject</h4>
                      <Input
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Body</h4>
                      <textarea
                        className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                      />
                    </div>
                    
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <label className="text-sm font-medium">Refine Draft</label>
                      <div className="flex gap-2">
                        <Input
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

                    <Button onClick={() => {
                      navigator.clipboard.writeText(`Subject: ${editedSubject}\n\n${editedBody}`);
                      toast.success("Copied to clipboard");
                    }}>Copy to Clipboard</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="w-full sm:w-1/2">
                        <label className="text-sm font-medium">Email Strategy</label>
                        <Select value={relationshipType} onValueChange={setRelationshipType}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Cold Outreach">Cold Outreach</SelectItem>
                            <SelectItem value="Warm Introduction">Warm Introduction</SelectItem>
                            <SelectItem value="Former Colleague">Former Colleague</SelectItem>
                            <SelectItem value="Follow Up">Follow Up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full sm:w-1/2">
                        <label className="text-sm font-medium">AI Provider</label>
                        <Select value={provider} onValueChange={(val) => handleProviderChange(val as ProviderType)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gemini">Gemini</SelectItem>
                            <SelectItem value="claude">Claude</SelectItem>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="grok">Grok</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full sm:w-1/2">
                        <label className="text-sm font-medium">AI Model</label>
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

                    <Button
                      onClick={() => generateOutreach(detail.company)}
                      disabled={generating || !detail.topContact}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {generating ? "Generating personalized outreach..." : "Generate Outreach Email"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
