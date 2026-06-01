"use client";

import { useState } from "react";
import { ExternalLink, Mail, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import type { GeneratedEmail, MatchedChunk, RankedContact } from "@/types/database";

type SearchResult = {
  contact: RankedContact | null;
  projects: (MatchedChunk & { summary?: string })[];
  message: string | null;
};

export function SearchCompanyView() {
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [emailDialog, setEmailDialog] = useState<GeneratedEmail | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch<SearchResult>("/api/search/company", {
        method: "POST",
        body: JSON.stringify({ company: company.trim() }),
      });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateEmail() {
    if (!result?.contact) return;
    setGenerating(true);
    try {
      const contactName = [
        result.contact.first_name,
        result.contact.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      const data = await apiFetch<{ email: GeneratedEmail }>(
        "/api/emails/generate",
        {
          method: "POST",
          body: JSON.stringify({
            company_name: company,
            contact_name: contactName,
            position: result.contact.position,
            email: result.contact.email,
            profile_url: result.contact.profile_url,
            projects: result.projects,
          }),
        }
      );
      setEditedSubject(data.email.subject);
      setEditedBody(data.email.body);
      setEmailDialog(data.email);
      toast.success("Email generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function copyEmail() {
    navigator.clipboard.writeText(
      `Subject: ${editedSubject}\n\n${editedBody}`
    );
    toast.success("Copied to clipboard");
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
              {loading ? "Searching…" : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Best Contact</CardTitle>
            </CardHeader>
            <CardContent>
              {!result.contact ? (
                <p className="text-muted-foreground">
                  {result.message ?? "No connection found."}
                </p>
              ) : (
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium">
                      {[result.contact.first_name, result.contact.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Position</dt>
                    <dd>{result.contact.position ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Company</dt>
                    <dd>{result.contact.company ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="flex items-center gap-1">
                      {result.contact.email ?? "—"}
                      {result.contact.email && (
                        <Mail className="h-3 w-3 text-muted-foreground" />
                      )}
                    </dd>
                  </div>
                  {result.contact.profile_url && (
                    <div>
                      <dt className="text-muted-foreground">Profile</dt>
                      <dd>
                        <a
                          href={result.contact.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          LinkedIn
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
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
                    <p className="text-xs text-muted-foreground">
                      {p.industry}
                    </p>
                    <p className="mt-2 text-sm">{p.summary ?? p.chunk_text.slice(0, 200)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {result.contact && result.projects.length > 0 && (
            <div className="lg:col-span-2">
              <Button onClick={handleGenerateEmail} disabled={generating}>
                <Mail className="mr-2 h-4 w-4" />
                {generating ? "Generating…" : "Generate Outreach Email"}
              </Button>
            </div>
          )}
        </div>
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
              <Textarea
                id="body"
                rows={12}
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
              />
            </div>
            <Button onClick={copyEmail}>Copy to Clipboard</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
