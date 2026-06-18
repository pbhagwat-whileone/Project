"use client";

import { useEffect } from "react";

export function AutoSyncWrapper() {
  useEffect(() => {
    fetch("/api/knowledge/auto-sync", { method: "POST" }).catch(console.error);
  }, []);

  return null;
}
