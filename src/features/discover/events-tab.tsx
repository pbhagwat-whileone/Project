"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, Calendar as CalendarIcon, MapPin, ExternalLink, SearchX } from "lucide-react";
import type { EventItem } from "@/domains/discover/services/eventsIntelligence";
import { Badge } from "@/components/ui/badge";
import { EventDrawer } from "./event-drawer";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const TECH_AREAS = [
  "All Technologies",
  "AI", "GenAI", "Cloud Infrastructure", "HPC", "Semiconductors",
  "Data Centers", "Edge Computing", "Platform Engineering", "SRE", "MLOps", "RISC-V", "ARM"
];

// Helper to format dates to like "Sep 18, 2026"
function formatDate(dateString: string) {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }).format(d);
  } catch (e) {
    return dateString;
  }
}

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
    if (locationFilter) {
      const locFilterLower = locationFilter.toLowerCase().trim();
      const eventLocLower = event.location.toLowerCase();
      
      const isIndiaSearch = locFilterLower === 'india';
      const indianCities = ['bangalore', 'bengaluru', 'mumbai', 'delhi', 'new delhi', 'pune', 'hyderabad', 'chennai', 'noida', 'gurugram', 'gurgaon', 'ahmedabad', 'kolkata'];
      
      if (isIndiaSearch) {
        const matchesIndia = eventLocLower.includes('india') || indianCities.some(city => eventLocLower.includes(city));
        if (!matchesIndia) return false;
      } else {
        if (!eventLocLower.includes(locFilterLower)) {
          return false;
        }
      }
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
    <div className="space-y-6 bg-card rounded-lg border p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Upcoming Industry Events</h2>
          <p className="text-sm text-muted-foreground mt-1">Discover conferences, summits, and expos relevant to your outreach.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchEvents(true)}
          disabled={isLoading}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Events
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/40 p-4 rounded-lg border">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Technology</label>
          <Select value={techFilter} onValueChange={setTechFilter}>
            <SelectTrigger className="bg-background">
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
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by city or 'Virtual'"
              className="pl-9 bg-background"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date Range</label>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="bg-background">
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
        <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      {isLoading && events.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="flex flex-col h-full border border-muted shadow-none">
              <CardHeader className="pb-4">
                <div className="flex gap-2 mb-3">
                  <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
                  <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
                </div>
                <div className="h-7 w-3/4 bg-muted animate-pulse rounded-md" />
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <div className="space-y-4 mb-5">
                  <div className="flex items-center">
                    <div className="h-4 w-4 rounded-full bg-muted animate-pulse mr-3" />
                    <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
                  </div>
                  <div className="flex items-center">
                    <div className="h-4 w-4 rounded-full bg-muted animate-pulse mr-3" />
                    <div className="h-4 w-32 bg-muted animate-pulse rounded-md" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted animate-pulse rounded-md" />
                  <div className="h-4 w-5/6 bg-muted animate-pulse rounded-md" />
                </div>
              </CardContent>
              <CardFooter className="pt-0 flex gap-3">
                <div className="h-10 flex-1 bg-muted animate-pulse rounded-md" />
                <div className="h-10 flex-1 bg-muted animate-pulse rounded-md" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-4 border-2 border-dashed rounded-xl bg-muted/10 text-center">
          <div className="bg-muted p-4 rounded-full mb-4 ring-8 ring-muted/50">
            <SearchX className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No events found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            We couldn't find any events matching your current filters. Try adjusting your technology, location, or date preferences.
          </p>
          <Button variant="default" onClick={() => {
            setTechFilter("All Technologies");
            setLocationFilter("");
            setDateFilter("all");
          }}>
            Clear All Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <Card 
              key={event.id} 
              className="flex flex-col h-full hover:border-primary/40 hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden group bg-card"
              onClick={() => setSelectedEvent(event)}
            >
              <CardHeader className="pb-4 bg-gradient-to-b from-muted/30 to-transparent border-b border-border/40">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {event.techTags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      {tag}
                    </Badge>
                  ))}
                  {event.techTags.length > 3 && (
                    <Badge variant="outline" className="text-[11px] font-medium">
                      +{event.techTags.length - 3}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
                  {event.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pt-4 pb-4">
                <div className="space-y-3 mb-5">
                  <div className="flex items-center text-sm font-medium text-foreground/80">
                    <CalendarIcon className="h-4 w-4 mr-3 text-muted-foreground" />
                    {formatDate(event.date)}
                  </div>
                  <div className="flex items-center text-sm font-medium text-foreground/80">
                    <MapPin className="h-4 w-4 mr-3 text-muted-foreground" />
                    <span className="line-clamp-1">{event.location}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {event.description}
                </p>
              </CardContent>
              <CardFooter className="pt-0 flex gap-3">
                <Button 
                  variant="default" 
                  className="w-full flex-1" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setSelectedEvent(event); 
                  }}
                >
                  View Details
                </Button>
                {event.website && event.website.length > 0 && (
                  <Button 
                    variant="outline" 
                    className="w-full flex-1 group/btn" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      window.open(event.website.startsWith('http') ? event.website : `https://${event.website}`, '_blank');
                    }}
                  >
                    Website <ExternalLink className="h-3.5 w-3.5 ml-2 text-muted-foreground group-hover/btn:text-foreground transition-colors" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

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
