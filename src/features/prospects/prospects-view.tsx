"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Sparkles, Upload, Zap } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  GeneratedEmail,
  MatchedChunk,
  Prospect,
  ProspectStatus,
  RankedContact,
} from "@/types/database";

const STATUSES: ProspectStatus[] = [
  "Researching",
  "Qualified",
  "Outreach Planned",
  "Contacted",
  "Won",
  "Lost",
];

const emptyForm = {
  company_name: "",
  website: "",
  country: "",
  industry: "",
  revenue_range: "",
  employee_count: "",
  notes: "",
  status: "Researching" as ProspectStatus,
};

type OutreachResult = {
  contact: RankedContact | null;
  projects: (MatchedChunk & { summary?: string })[];
  email: GeneratedEmail | null;
  message: string | null;
};

export function ProspectsView() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    country: "",
    industry: "",
    revenue: "",
    employees: "",
    status: "",
    q: "",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [outreach, setOutreach] = useState<OutreachResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k === "q" ? "q" : k, v);
      });
      const qs = params.toString() ? `?${params}` : "";
      const data = await apiFetch<{ prospects: Prospect[] }>(
        `/api/prospects${qs}`
      );
      setProspects(data.prospects);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p: Prospect) {
    setEditing(p);
    setForm({
      company_name: p.company_name,
      website: p.website ?? "",
      country: p.country ?? "",
      industry: p.industry ?? "",
      revenue_range: p.revenue_range ?? "",
      employee_count: p.employee_count ?? "",
      notes: p.notes ?? "",
      status: p.status,
    });
    setDialogOpen(true);
  }

  async function saveProspect() {
    try {
      if (editing) {
        await apiFetch(`/api/prospects/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        toast.success("Prospect updated");
      } else {
        await apiFetch("/api/prospects", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Prospect created");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function deleteProspect(id: string) {
    if (!confirm("Delete this prospect?")) return;
    try {
      await apiFetch(`/api/prospects/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function runAnalysis(id: string) {
    setBusy(`analysis-${id}`);
    try {
      const data = await apiFetch<{ analysis: { analysis: string } }>(
        `/api/prospects/${id}/analysis`,
        { method: "POST" }
      );
      setAnalysis(data.analysis.analysis);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(null);
    }
  }

  async function runOutreach(id: string) {
    setBusy(`outreach-${id}`);
    try {
      const data = await apiFetch<OutreachResult>(
        `/api/prospects/${id}/outreach`,
        { method: "POST" }
      );
      setOutreach(data);
      if (data.message) toast.info(data.message);
      else toast.success("Outreach generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Outreach failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/prospects/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Imported ${data.imported} prospects`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  }

  const filterOptions = {
    countries: [...new Set(prospects.map((p) => p.country).filter(Boolean))],
    industries: [...new Set(prospects.map((p) => p.industry).filter(Boolean))],
    revenues: [
      ...new Set(prospects.map((p) => p.revenue_range).filter(Boolean)),
    ],
    employees: [
      ...new Set(prospects.map((p) => p.employee_count).filter(Boolean)),
    ],
  };

  return (
    <div>
      <PageHeader
        title="Prospects"
        description="Target companies pipeline with AI analysis and outreach."
        action={
          <div className="flex gap-2">
            <input
              ref={importRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" onClick={() => importRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Prospect
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Input
          placeholder="Search company…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
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
              <SelectItem key={c} value={c!}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {filterOptions.industries.map((c) => (
              <SelectItem key={c} value={c!}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.revenue || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, revenue: v === "all" ? "" : v }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Revenue" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All revenue</SelectItem>
            {filterOptions.revenues.map((c) => (
              <SelectItem key={c} value={c!}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.employees || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, employees: v === "all" ? "" : v }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sizes</SelectItem>
            {filterOptions.employees.map((c) => (
              <SelectItem key={c} value={c!}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, status: v === "all" ? "" : v }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : prospects.length === 0 ? (
        <EmptyState
          title="No prospects"
          description="Add target companies manually or import from CSV."
          action={<Button onClick={openCreate}>Add Prospect</Button>}
        />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.company_name}</TableCell>
                  <TableCell>{p.industry ?? "—"}</TableCell>
                  <TableCell>{p.country ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(p)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => runAnalysis(p.id)}
                        disabled={busy === `analysis-${p.id}`}
                      >
                        <Sparkles className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => runOutreach(p.id)}
                        disabled={busy === `outreach-${p.id}`}
                      >
                        <Zap className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteProspect(p.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Prospect" : "Add Prospect"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Company Name *</Label>
              <Input
                value={form.company_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, company_name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Website</Label>
                <Input
                  value={form.website}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, website: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Country</Label>
                <Input
                  value={form.country}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, country: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Industry</Label>
                <Input
                  value={form.industry}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, industry: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v as ProspectStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Revenue Range</Label>
                <Input
                  value={form.revenue_range}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, revenue_range: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Employee Count</Label>
                <Input
                  value={form.employee_count}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      employee_count: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
            <Button onClick={saveProspect}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!analysis} onOpenChange={() => setAnalysis(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prospect Analysis</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
            {analysis}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!outreach} onOpenChange={() => setOutreach(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Outreach Workflow Results</DialogTitle>
          </DialogHeader>
          {outreach && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 font-medium">Contact</h4>
                {!outreach.contact ? (
                  <p className="text-sm text-muted-foreground">
                    {outreach.message ?? "No connection found."}
                  </p>
                ) : (
                  <dl className="space-y-1 text-sm">
                    <dd className="font-medium">
                      {[outreach.contact.first_name, outreach.contact.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </dd>
                    <dd>{outreach.contact.position}</dd>
                    <dd>{outreach.contact.email}</dd>
                  </dl>
                )}
                <h4 className="mb-2 mt-4 font-medium">Projects</h4>
                {outreach.projects.map((p) => (
                  <div key={p.id} className="mb-2 rounded border p-2 text-sm">
                    <p className="font-medium">{p.project_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(p.similarity * 100).toFixed(0)}% — {p.industry}
                    </p>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="mb-2 font-medium">Generated Email</h4>
                {outreach.email ? (
                  <>
                    <p className="text-sm font-medium">
                      Subject: {outreach.email.subject}
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap rounded border p-3 text-sm">
                      {outreach.email.body}
                    </pre>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No email generated.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
