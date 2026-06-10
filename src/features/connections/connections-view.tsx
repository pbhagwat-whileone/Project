"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ConversationHistoryModal } from "./conversation-history-modal";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import type { Connection } from "@/types/database";

export function ConnectionsView() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("All Owners");
  const [ownersList, setOwnersList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingMessages, setUploadingMessages] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesFileRef = useRef<HTMLInputElement>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const searchParams = useSearchParams();
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadOwnerName, setUploadOwnerName] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (companyFilter) params.set("company", companyFilter);
      if (ownerFilter !== "All Owners") params.set("owner", ownerFilter);
      const qs = params.toString() ? `?${params}` : "";

      const [data, ownersData] = await Promise.all([
        apiFetch<{ connections: Connection[] }>(`/api/connections${qs}`),
        apiFetch<{ owners: string[] }>("/api/connections/owners")
      ]);

      setConnections(data.connections);
      setOwnersList(ownersData.owners);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [search, companyFilter, ownerFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      load();
    }, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const connectionId = searchParams.get("connection_id");
    if (connectionId && connections.length > 0 && !hasAutoOpened) {
      const conn = connections.find(c => c.id === connectionId);
      if (conn) {
        setSelectedConnection(conn);
        setHasAutoOpened(true);
      }
    }
  }, [searchParams, connections, hasAutoOpened]);

  async function confirmUpload() {
    if (!pendingFile || !uploadOwnerName.trim()) {
      toast.error("Please provide an owner name");
      return;
    }

    setUploading(true);
    setShowUploadModal(false);

    const formData = new FormData();
    formData.append("file", pendingFile);
    formData.append("connection_owner_name", uploadOwnerName.trim());

    try {
      const res = await fetch("/api/connections/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      let message = `Imported: ${data.imported}`;
      if (data.updated > 0) message += ` | Updated: ${data.updated}`;
      if (data.skipped > 0) message += ` | Skipped: ${data.skipped} duplicates`;

      toast.success(message);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setPendingFile(null);
      setUploadOwnerName("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleUpload(file: File) {
    setPendingFile(file);
    setShowUploadModal(true);
  }

  async function handleMessagesUpload(file: File) {
    setUploadingMessages(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/connections/messages-upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Parsed: ${data.parsed} | Inserted: ${data.inserted} | Skipped: ${data.skipped}`);
      if (data.inserted > 0) {
        toast.success(`Updated metrics for ${data.metricsUpdated} connections.`);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingMessages(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Connections"
        description="LinkedIn connection exports for company and contact matching."
        action={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            <input
              ref={messagesFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleMessagesUpload(file);
                e.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => messagesFileRef.current?.click()}
                disabled={uploadingMessages}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadingMessages ? "Uploading…" : "Upload Messages CSV"}
              </Button>
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading…" : "Upload Connections CSV"}
              </Button>
            </div>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email, position…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Input
          placeholder="Filter by company…"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        />
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Owners">All Owners</SelectItem>
            {ownersList.map((owner) => (
              <SelectItem key={owner} value={owner}>
                {owner}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : connections.length === 0 ? (
        <EmptyState
          title="No connections"
          description="Upload your LinkedIn CSV to begin discovering opportunities."
          action={
            <Button onClick={() => fileRef.current?.click()}>
              Upload CSV
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-center">Actions</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                      "—"}
                  </TableCell>
                  <TableCell>{c.company ?? "—"}</TableCell>
                  <TableCell>{c.position ?? "—"}</TableCell>
                  <TableCell>{(c as any).connection_owner_name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedConnection(c)}>
                      View History
                    </Button>
                  </TableCell>
                  <TableCell>
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConversationHistoryModal
        connection={selectedConnection}
        onClose={() => setSelectedConnection(null)}
      />

      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connection Owner</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="owner-name" className="mb-2 block">
              Whose LinkedIn network does this belong to?
            </Label>
            <Input
              id="owner-name"
              placeholder="e.g. Sameer Natu"
              value={uploadOwnerName}
              onChange={(e) => setUploadOwnerName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadModal(false);
              setPendingFile(null);
              if (fileRef.current) fileRef.current.value = "";
            }}>
              Cancel
            </Button>
            <Button onClick={confirmUpload} disabled={uploading}>
              {uploading ? "Importing..." : "Start Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
