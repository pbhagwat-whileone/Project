"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import type { KnowledgeDocumentWithCount } from "@/types/database";

export function KnowledgeBaseView() {
  const [documents, setDocuments] = useState<KnowledgeDocumentWithCount[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : "";
      const data = await apiFetch<{ documents: KnowledgeDocumentWithCount[] }>(
        `/api/knowledge/documents${q}`
      );
      setDocuments(data.documents);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      load();
    }, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await apiFetch<{ message: string }>(
        "/api/knowledge/sync",
        { method: "POST" }
      );
      toast.success(result.message);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Google Drive project documents synced and embedded for semantic search."
        action={
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Processing project knowledge..." : "Sync Now"}
          </Button>
        }
      />

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Sync Google Drive documents to build your knowledge base."
          action={
            <Button onClick={handleSync} disabled={syncing}>
              Sync Knowledge Base
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Name</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Chunk Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    {doc.document_name}
                  </TableCell>
                  <TableCell>{formatDate(doc.last_modified)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        doc.status === "synced"
                          ? "success"
                          : doc.status === "error"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {doc.chunk_count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
