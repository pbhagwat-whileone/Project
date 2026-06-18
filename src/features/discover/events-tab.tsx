"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, Calendar as CalendarIcon, MapPin } from "lucide-react";
import type { EventItem } from "@/domains/discover/services/eventsIntelligence";
import { Badge } from "@/components/ui/badge";
import { EventDrawer } from "./event-drawer";

const TECH_AREAS = [
  "All Technologies",
  "AI", "GenAI", "Cloud Infrastructure", "HPC", "Semiconductors",
  "Data Centers", "Edge Computing", "Platform Engineering", "SRE", "MLOps", "RISC-V", "ARM"
];

export function EventsTab() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [techFilter, setTechFilter] = useState("All Technologies");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all");

  // Drawer state
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  const fetchEvents = async (refresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/discover/events${refresh ? "?refresh=true" : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      const data = await response.json();

      // Default sort by date ascending
      const sorted = (data.data || []).sort((a: EventItem, b: EventItem) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      setEvents(sorted);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const filteredEvents = events.filter(event => {
    // Tech filter
    if (techFilter !== "All Technologies" && !event.techTags.includes(techFilter)) {
      return false;
    }

    // Location filter
    if (locationFilter && !event.location.toLowerCase().includes(locationFilter.toLowerCase())) {
      return false;
    }

    // Date filter
    if (dateFilter !== "all") {
      const eventDate = new Date(event.date);
      const now = new Date();
      const diffTime = Math.abs(eventDate.getTime() - now.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (dateFilter === "30" && diffDays > 30) return false;
      if (dateFilter === "90" && diffDays > 90) return false;
      if (dateFilter === "180" && diffDays > 180) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 bg-card rounded-lg border p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Upcoming Industry Events</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchEvents(true)}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Events
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-md">
        <div className="space-y-2">
          <label className="text-xs font-medium">Technology</label>
          <Select value={techFilter} onValueChange={setTechFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Select Technology" />
            </SelectTrigger>
            <SelectContent>
              {TECH_AREAS.map(tech => (
                <SelectItem key={tech} value={tech}>{tech}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">Location</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by city or 'Virtual'"
              className="pl-9"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">Date Range</label>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Select Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Upcoming</SelectItem>
              <SelectItem value="30">Next 30 Days</SelectItem>
              <SelectItem value="90">Next 90 Days</SelectItem>
              <SelectItem value="180">Next 6 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
          {error}
        </div>
      )}

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Technology Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Finding relevant events...</p>
                </TableCell>
              </TableRow>
            ) : filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  No events found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredEvents.map((event) => (
                <TableRow
                  key={event.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedEvent(event)}
                >
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center text-muted-foreground whitespace-nowrap">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {event.date}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-muted-foreground whitespace-nowrap">
                      <MapPin className="h-3 w-3 mr-1" />
                      {event.location}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {event.techTags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs font-normal">
                          {tag}
                        </Badge>
                      ))}
                      {event.techTags.length > 3 && (
                        <span className="text-xs text-muted-foreground ml-1">+{event.techTags.length - 3}</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EventDrawer
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(open: boolean) => {
          if (!open) setSelectedEvent(null);
        }}
      />
    </div>
  );
}
