"use client";

import { EventsTab } from "./events-tab";

export function DiscoverView() {
  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
          <p className="text-muted-foreground mt-2">
            Company-wide industry intelligence and events.
          </p>
        </div>

        <div className="space-y-4">
          <EventsTab />
        </div>
      </div>
    </div>
  );
}
