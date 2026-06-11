"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { SyncLog } from "@/types/database";

export function SettingsView() {
  const searchParams = useSearchParams();
  const [folderIds, setFolderIds] = useState("");
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<{
        google_drive_folder_ids: string[];
        last_sync: SyncLog | null;
        google_connected: boolean;
      }>("/api/settings");
      setFolderIds(data.google_drive_folder_ids?.join("\n") ?? "");
      setLastSync(data.last_sync);
      setGoogleConnected(data.google_connected);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (searchParams.get("google") === "connected") {
      toast.success("Google Drive connected");
    }
    if (searchParams.get("error") === "google") {
      toast.error("Google connection failed");
    }
  }, [searchParams]);

  async function saveSettings() {
    setSaving(true);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          google_drive_folder_ids: folderIds
            .split("\n")
            .map((id) => id.trim())
            .filter(Boolean),
        }),
      });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading settings…" />;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure Google Drive integration and sync preferences."
      />

      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Google Drive</CardTitle>
            <CardDescription>
              Connect Drive to sync project documents from your folder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {googleConnected ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm">Drive connected</span>
                  <Badge variant="success">Active</Badge>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Not connected
                </span>
              )}
            </div>
            <Button variant="outline" asChild>
              <a href="/api/google/authorize">
                <Link2 className="mr-2 h-4 w-4" />
                {googleConnected ? "Reconnect Google Drive" : "Connect Google Drive"}
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drive Folders</CardTitle>
            <CardDescription>
              Google Drive folder IDs containing project docs (add one per line).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="folder">Google Drive Folder ID's</Label>
              <Textarea
                id="folder"
                className="mt-2 font-mono"
                placeholder="1AbCdEfGhIjKlMn&#10;2XyZaBcDeFgHiJk"
                rows={4}
                value={folderIds}
                onChange={(e) => setFolderIds(e.target.value)}
              />
            </div>
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sync Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Sync</span>
              <span>{formatDate(lastSync?.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              {lastSync ? (
                <Badge
                  variant={
                    lastSync.status === "success"
                      ? "success"
                      : lastSync.status === "partial"
                        ? "warning"
                        : "destructive"
                  }
                >
                  {lastSync.status}
                </Badge>
              ) : (
                <span>—</span>
              )}
            </div>
            {lastSync?.message && (
              <p className="mt-2 text-muted-foreground">{lastSync.message}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
