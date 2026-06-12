"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, MapPin, ExternalLink, Globe } from "lucide-react";
import type { EventItem } from "@/services/events-intelligence";
import { Badge } from "@/components/ui/badge";

interface EventDrawerProps {
  event: EventItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDrawer({ event, open, onOpenChange }: EventDrawerProps) {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-y-auto max-h-[90vh]">
        <DialogHeader className="mb-6 pb-6 border-b text-left">
          <DialogTitle className="text-2xl font-bold leading-tight">{event.name}</DialogTitle>
          <DialogDescription asChild>
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center text-foreground">
                <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{event.date}</span>
              </div>
              <div className="flex items-center text-foreground">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{event.location}</span>
              </div>
              {event.website && (
                <div className="flex items-center text-primary hover:underline">
                  <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                  <a href={event.website} target="_blank" rel="noopener noreferrer" className="truncate max-w-[280px]">
                    {event.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-2">About this event</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {event.description || "No description provided."}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Technology Focus</h3>
            <div className="flex flex-wrap gap-2">
              {event.techTags && event.techTags.length > 0 ? (
                event.techTags.map(tag => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Not specified</span>
              )}
            </div>
          </div>
          
          <div className="pt-6 border-t">
             <Button 
                className="w-full" 
                onClick={() => window.open(event.website, '_blank')}
                disabled={!event.website}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Visit Event Website
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
