"use client";

import { useEffect, useState } from "react";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { GeneratedEmail } from "@/types/database";

export function EmailsView() {
  const [emails, setEmails] = useState<GeneratedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GeneratedEmail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GeneratedEmail | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  }

  function copyEmail() {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    toast.success("Copied");
  }

  async function regenerate() {
    if (!selected) return;
    setRegenerating(true);
    try {
      const data = await apiFetch<{ email: GeneratedEmail }>(
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
      toast.success("Email regenerated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegenerating(false);
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
                <TableHead className="text-right">Actions</TableHead>
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
              <Textarea
                rows={14}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyEmail}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button onClick={regenerate} disabled={regenerating}>
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${regenerating ? "animate-spin" : ""}`}
                />
                Regenerate
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
