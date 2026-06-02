"use client";

import { useCallback, useEffect, useState } from "react";
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
  IndustryExpertise,
} from "@/services/prospect-recommendation";
import type { GeneratedEmail } from "@/types/database";

type RankedRecommendation = CompanyRecommendation & { rank: number };

export function ProspectsView() {
  const [recommendations, setRecommendations] = useState<RankedRecommendation[]>(
    []
  );
  const [expertise, setExpertise] = useState<IndustryExpertise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    industry: "",
    country: "",
    companySize: "",
    revenueBand: "",
    minScore: "",
  });
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(
    null
  );

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.industry) params.set("industry", filters.industry);
      if (filters.country) params.set("country", filters.country);
      if (filters.companySize) params.set("companySize", filters.companySize);
      if (filters.revenueBand) params.set("revenueBand", filters.revenueBand);
      if (filters.minScore) params.set("minScore", filters.minScore);

      const qs = params.toString() ? `?${params}` : "";
      const data = await apiFetch<{
        recommendations: RankedRecommendation[];
        expertise: IndustryExpertise[];
      }>(`/api/prospects${qs}`);

      setRecommendations(data.recommendations);
      setExpertise(data.expertise);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
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
          body: JSON.stringify({ company_name: company }),
        }
      );
      setGeneratedEmail(data.email);
      toast.success("Outreach email generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    load();
  }

  const filterOptions = {
    industries: [
      ...new Set(recommendations.map((r) => r.industry).filter(Boolean)),
    ],
    countries: [
      ...new Set(recommendations.map((r) => r.country).filter(Boolean)),
    ] as string[],
    sizes: [
      ...new Set(recommendations.map((r) => r.companySize).filter(Boolean)),
    ] as string[],
    revenues: [
      ...new Set(recommendations.map((r) => r.revenueBand).filter(Boolean)),
    ] as string[],
  };

  return (
    <div>
      <PageHeader
        title="Recommended Companies"
        description="AI-ranked outreach targets based on project expertise and LinkedIn connections."
        action={
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      {expertise.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Industry Expertise</CardTitle>
            <CardDescription>
              Project history used to score recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {expertise.slice(0, 8).map((exp) => (
                <Badge key={exp.industry} variant="secondary">
                  {exp.industry}: {exp.projectCount} project
                  {exp.projectCount === 1 ? "" : "s"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search company or industry…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <Select
          value={filters.industry || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, industry: v === "all" ? "" : v }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {filterOptions.industries.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.country || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, country: v === "all" ? "" : v }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {filterOptions.countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.companySize || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, companySize: v === "all" ? "" : v }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Company size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sizes</SelectItem>
            {filterOptions.sizes.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.revenueBand || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, revenueBand: v === "all" ? "" : v }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Revenue" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All revenue</SelectItem>
            {filterOptions.revenues.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={0}
          max={100}
          placeholder="Min score"
          value={filters.minScore}
          onChange={(e) =>
            setFilters((f) => ({ ...f, minScore: e.target.value }))
          }
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : recommendations.length === 0 ? (
        <EmptyState
          title="No recommendations yet"
          description="Upload LinkedIn connections and sync your knowledge base to generate company recommendations."
        />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Connections</TableHead>
                <TableHead>Top Contact</TableHead>
                <TableHead>Projects</TableHead>
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
                  <TableCell>{rec.industry}</TableCell>
                  <TableCell>
                    <Badge variant={rec.recommendationScore >= 70 ? "success" : "secondary"}>
                      {rec.recommendationScore}
                    </Badge>
                  </TableCell>
                  <TableCell>{rec.connectionCount}</TableCell>
                  <TableCell className="max-w-[160px] truncate">
                    {rec.topContact?.position ?? "—"}
                  </TableCell>
                  <TableCell>{rec.matchingProjectCount}</TableCell>
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
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail?.company ?? selectedCompany ?? "Company Detail"}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <LoadingSpinner label="Loading company detail…" />
          ) : detail ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 font-medium">Company Information</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Industry</dt>
                      <dd>{detail.industry}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Score</dt>
                      <dd>{detail.recommendationScore}/100</dd>
                    </div>
                    {detail.country && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Country</dt>
                        <dd>{detail.country}</dd>
                      </div>
                    )}
                    {detail.companySize && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Size</dt>
                        <dd>{detail.companySize}</dd>
                      </div>
                    )}
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
                        <p className="text-xs text-muted-foreground">
                          {p.industry}
                        </p>
                        <p className="mt-1">{p.chunk_text.slice(0, 150)}…</p>
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
                  <div className="rounded border p-3">
                    <p className="text-sm font-medium">
                      Subject: {generatedEmail.subject}
                    </p>
                    <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm">
                      {generatedEmail.body}
                    </pre>
                  </div>
                ) : (
                  <Button
                    onClick={() => generateOutreach(detail.company)}
                    disabled={generating || !detail.topContact}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {generating ? "Generating…" : "Generate Outreach Email"}
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
