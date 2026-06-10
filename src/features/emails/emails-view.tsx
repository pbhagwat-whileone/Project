"use client";

import { useEffect, useState } from "react";
import { Copy, RefreshCw, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { EmailEditor, formatEmailBodyToHtml } from "@/components/ui/email-editor";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { GeneratedEmail, CompanyContext, CompanyContextRelevance, RelationshipIntelligence } from "@/types/database";
import { PROVIDER_MODELS, PROVIDERS, type ProviderType } from "@/ai/models";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export function EmailsView() {
  const [emails, setEmails] = useState<GeneratedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GeneratedEmail | null>(null);
  const [selectedCompanyContext, setSelectedCompanyContext] = useState<CompanyContext | null>(null);
  const [selectedCompanyContextRelevance, setSelectedCompanyContextRelevance] = useState<CompanyContextRelevance | null>(null);
  const [selectedRelationshipIntelligence, setSelectedRelationshipIntelligence] = useState<RelationshipIntelligence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GeneratedEmail | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [provider, setProvider] = useState<ProviderType>("gemini");
  const [model, setModel] = useState<string>("gemini-2.5-pro");
  const [refinementInstruction, setRefinementInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);

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

  async function load() {
    try {
      const data = await apiFetch<{ emails: GeneratedEmail[] }>("/api/emails");
      setEmails(data.emails);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openEmail(email: GeneratedEmail) {
    setSelected(email);
    setSubject(email.subject);
    setBody(email.body);
    const savedProvider = (email.provider_used as ProviderType) || "gemini";
    setProvider(savedProvider);
    if (PROVIDER_MODELS[savedProvider]) {
      setModel(PROVIDER_MODELS[savedProvider][0]);
    }
    setRefinementInstruction("");
    setSelectedCompanyContext(null); // Clear context since we don't have it for old emails
    setSelectedCompanyContextRelevance(null);
    setSelectedRelationshipIntelligence(null);
  }

  async function copyEmail() {
    try {
      const plainText = `Subject: ${subject}\n\n${body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')}`;
      const htmlText = `<p><strong>Subject:</strong> ${subject}</p><br/>${formatEmailBodyToHtml(body)}`;
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
      navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      toast.success("Copied");
    }
  }

  async function regenerate() {
    if (!selected) return;
    setRegenerating(true);
    try {
      const data = await apiFetch<{ email: GeneratedEmail, companyContext?: CompanyContext, companyContextRelevance?: CompanyContextRelevance, relationshipIntelligence?: RelationshipIntelligence }>(
        "/api/emails/generate",
        {
          method: "POST",
          body: JSON.stringify({
            company_name: selected.company_name,
            contact_name: selected.contact_name,
          }),
        }
      );
      setSubject(data.email.subject);
      setBody(data.email.body);
      setSelectedCompanyContext(data.companyContext || null);
      setSelectedCompanyContextRelevance(data.companyContextRelevance || null);
      setSelectedRelationshipIntelligence(data.relationshipIntelligence || null);
      toast.success("Email regenerated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRefine() {
    if (!selected) {
      toast.error("No email selected.");
      return;
    }

    if (!refinementInstruction || typeof refinementInstruction !== "string" || !refinementInstruction.trim()) {
      toast.error("Refinement instruction must be a non-empty string.");
      return;
    }

    if (!subject || typeof subject !== "string") {
      toast.error("Current subject must be a valid string.");
      return;
    }

    if (!body || typeof body !== "string") {
      toast.error("Current draft body must be a valid string.");
      return;
    }

    const safeProvider = typeof provider === "string" && provider.trim() ? provider : "gemini";

    setRefining(true);
    try {
      const data = await apiFetch<{ email: GeneratedEmail }>(
        "/api/emails/refine",
        {
          method: "POST",
          body: JSON.stringify({
            email_id: selected.id,
            current_subject: subject,
            current_body: body,
            instructions: refinementInstruction,
            provider: safeProvider,
            model,
            context: {
              company: selected.company_name,
              contactName: selected.contact_name || "Unknown",
            },
          }),
        }
      );
      setSubject(data.email.subject);
      setBody(data.email.body);
      setRefinementInstruction("");
      toast.success("Draft refined successfully");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefining(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await apiFetch<{ email: GeneratedEmail }>(
        `/api/emails/${selected.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            subject,
            body,
          }),
        }
      );
      toast.success("Changes saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/emails/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Email deleted");
      if (selected?.id === deleteTarget.id) {
        setSelected(null);
      }
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Generated Emails"
        description="AI-drafted outreach emails saved for review and copy."
      />

      {loading ? (
        <LoadingSpinner />
      ) : emails.length === 0 ? (
        <EmptyState
          title="No emails yet"
          description="Generate emails from Search Company or Recommended Companies."
        />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="max-w-xs truncate font-medium">
                    {email.subject}
                  </TableCell>
                  <TableCell>{email.company_name}</TableCell>
                  <TableCell>{email.contact_name ?? "—"}</TableCell>
                  <TableCell>{formatDate(email.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEmail(email)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(email)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Body</Label>
              <EmailEditor
                rows={10}
                value={body}
                onChange={setBody}
              />
            </div>

            {selectedRelationshipIntelligence && (
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
                      <Badge variant="outline">{selectedRelationshipIntelligence.relationshipType.replace(/-/g, " ")}</Badge>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-medium text-muted-foreground">Confidence</span>
                      <span>{selectedRelationshipIntelligence.confidence}%</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-medium text-muted-foreground">Outreach Goal</span>
                      <span className="uppercase text-xs font-semibold">{selectedRelationshipIntelligence.outreachGoal.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-medium text-muted-foreground">Capability Prominence</span>
                      <Badge variant={selectedRelationshipIntelligence.capabilityProminence === "high" ? "default" : "secondary"}>
                        {selectedRelationshipIntelligence.capabilityProminence.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="bg-background rounded border p-3 mt-4">
                    <span className="font-semibold block mb-1">AI Reasoning:</span>
                    <p className="text-muted-foreground italic">&ldquo;{selectedRelationshipIntelligence.reasoning}&rdquo;</p>
                  </div>
                </div>
              </details>
            )}

            {selectedCompanyContext && (
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

                  {selectedCompanyContextRelevance && (
                    <div className="bg-background rounded border p-3 mb-4">
                      <h4 className="font-semibold mb-2 flex items-center justify-between">
                        Relevance Evaluation
                        <Badge variant="outline" className={
                          selectedCompanyContextRelevance.recommendedUsage === "ignore" ? "border-destructive text-destructive" :
                            selectedCompanyContextRelevance.recommendedUsage === "primary_outreach_angle" ? "border-green-500 text-green-500" :
                              "border-yellow-500 text-yellow-500"
                        }>
                          {selectedCompanyContextRelevance.recommendedUsage.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                      </h4>
                      <p className="text-muted-foreground mb-2"><span className="font-medium">Score:</span> {selectedCompanyContextRelevance.relevanceScore}/100</p>
                      <p className="text-muted-foreground italic">&ldquo;{selectedCompanyContextRelevance.reasoning}&rdquo;</p>
                    </div>
                  )}

                  {selectedCompanyContext.summary && (
                    <div>
                      <h4 className="font-semibold mb-1">Summary</h4>
                      <p className="text-muted-foreground">{selectedCompanyContext.summary}</p>
                    </div>
                  )}

                  {selectedCompanyContext.keyInitiatives?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Key Initiatives</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {selectedCompanyContext.keyInitiatives.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedCompanyContext.hiringSignals?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Hiring Signals</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {selectedCompanyContext.hiringSignals.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedCompanyContext.technologySignals?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Technology Signals</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {selectedCompanyContext.technologySignals.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedCompanyContext.businessPriorities?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Business Priorities</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {selectedCompanyContext.businessPriorities.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedCompanyContext.outreachOpportunities?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Outreach Opportunities</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {selectedCompanyContext.outreachOpportunities.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedCompanyContext.sources?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Sources</h4>
                      <ul className="pl-5 space-y-1 text-muted-foreground text-xs">
                        {selectedCompanyContext.sources.map((src, i) => (
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
                <div className="w-full sm:w-1/2">
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

            <div className="flex justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyEmail}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
                <Button variant="outline" onClick={regenerate} disabled={regenerating}>
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${regenerating ? "animate-spin" : ""}`}
                  />
                  Regenerate
                </Button>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Email</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the email &ldquo;
            {deleteTarget?.subject}&rdquo;? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
