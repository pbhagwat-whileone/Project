"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  Mail,
  RefreshCw,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
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

type Stats = {
  documents: number;
  chunks: number;
  connections: number;
  prospects: number;
  emails: number;
};

export function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<{
        stats: Stats;
        recentActivity: SyncLog[];
      }>("/api/dashboard/stats");
      setStats(data.stats);
      setActivity(data.recentActivity);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  if (loading) return <LoadingSpinner label="Loading dashboard…" />;

  const statCards = [
    { label: "Documents", value: stats?.documents ?? 0, icon: BookOpen },
    { label: "Chunks", value: stats?.chunks ?? 0, icon: BookOpen },
    { label: "Connections", value: stats?.connections ?? 0, icon: Users },
    { label: "Companies", value: stats?.prospects ?? 0, icon: Building2 },
    { label: "Emails", value: stats?.emails ?? 0, icon: Mail },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your outreach knowledge base and pipeline."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common outreach workflows</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw
                className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              />
              Sync Knowledge Base
            </Button>
            <Button variant="outline" className="justify-start gap-2" asChild>
              <Link href="/connections">
                <Upload className="h-4 w-4" />
                Upload Connections
              </Link>
            </Button>
            <Button variant="outline" className="justify-start gap-2" asChild>
              <Link href="/search-company">
                <Search className="h-4 w-4" />
                Search Company
              </Link>
            </Button>
            <Button variant="outline" className="justify-start gap-2" asChild>
              <Link href="/prospects">
                <Building2 className="h-4 w-4" />
                View Recommendations
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Knowledge base sync history</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sync activity yet. Run a knowledge base sync from Settings or
                above.
              </p>
            ) : (
              <ul className="space-y-3">
                {activity.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-start justify-between gap-4 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {log.documents_processed} document(s) processed
                      </p>
                      <p className="text-muted-foreground">{log.message}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge
                        variant={
                          log.status === "success"
                            ? "success"
                            : log.status === "partial"
                              ? "warning"
                              : "destructive"
                        }
                      >
                        {log.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
