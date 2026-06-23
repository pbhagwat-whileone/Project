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
  const [caseStudiesUrl, setCaseStudiesUrl] = useState("");
  const [globalSyncState, setGlobalSyncState] = useState<any>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<{
        google_drive_folder_ids: string[];
        case_studies_sheet_url?: string;
        last_sync: any;
        google_connected: boolean;
      }>("/api/settings");
      setFolderIds(data.google_drive_folder_ids?.join("\n") ?? "");
      setCaseStudiesUrl(data.case_studies_sheet_url ?? "");
      setGlobalSyncState(data.last_sync);
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
          case_studies_sheet_url: caseStudiesUrl,
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
            <CardTitle>Case Studies Master Sheet</CardTitle>
            <CardDescription>
              Google Sheets URL containing curated case studies for email context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="case-studies">Sheet URL</Label>
              <Textarea
                id="case-studies"
                className="mt-2 font-mono"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                rows={2}
                value={caseStudiesUrl}
                onChange={(e) => setCaseStudiesUrl(e.target.value)}
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
              <span>{formatDate(globalSyncState?.last_successful_sync)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              {globalSyncState ? (
                <Badge
                  variant={
                    globalSyncState.sync_in_progress
                      ? "warning"
                      : "success"
                  }
                >
                  {globalSyncState.sync_in_progress ? "Syncing..." : "Idle"}
                </Badge>
              ) : (
                <span>—</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
