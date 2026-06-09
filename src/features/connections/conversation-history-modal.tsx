"use client";

import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { apiFetch } from "@/lib/api";
import type { ConnectionRelationshipMetrics, LinkedinMessage, Connection } from "@/types/database";

interface ConversationHistoryModalProps {
  connection: Connection | null;
  onClose: () => void;
}

export function ConversationHistoryModal({ connection, onClose }: ConversationHistoryModalProps) {
  const [messages, setMessages] = useState<LinkedinMessage[]>([]);
  const [metrics, setMetrics] = useState<ConnectionRelationshipMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!connection) return;

    async function loadData() {
      setLoading(true);
      try {
        const data = await apiFetch<{ messages: LinkedinMessage[]; metrics: ConnectionRelationshipMetrics | null }>(
          `/api/connections/${connection!.id}/messages`
        );
        setMessages(data.messages);
        setMetrics(data.metrics);
      } catch (err) {
        console.error("Failed to load conversation history:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [connection]);

  const groupedConversations = useMemo(() => {
    if (!messages.length) return [];
    
    const groups = new Map<string, LinkedinMessage[]>();
    for (const msg of messages) {
      const convId = msg.conversation_id || "unknown";
      if (!groups.has(convId)) {
        groups.set(convId, []);
      }
      groups.get(convId)!.push(msg);
    }
    
    const convos = Array.from(groups.entries()).map(([id, msgs]) => {
      const sortedMsgs = [...msgs].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
      const latestDate = new Date(sortedMsgs[sortedMsgs.length - 1].date || 0).getTime();
      return { id, messages: sortedMsgs, latestDate };
    });
    
    return convos.sort((a, b) => b.latestDate - a.latestDate);
  }, [messages]);

  if (!connection) return null;

  return (
    <Dialog open={!!connection} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Conversation History: {[connection.first_name, connection.last_name].filter(Boolean).join(" ")}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8"><LoadingSpinner /></div>
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden h-full">
            {metrics && (
              <div className="bg-muted p-4 rounded-md text-sm shrink-0">
                <div className="font-semibold mb-2">Relationship Metrics</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-muted-foreground text-xs">Messages</div>
                    <div>{metrics.message_count}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Conversations</div>
                    <div>{metrics.conversation_count}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Score</div>
                    <div>{metrics.relationship_score}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Last Contact</div>
                    <div>{metrics.last_contact_date ? format(new Date(metrics.last_contact_date), "PP") : "—"}</div>
                  </div>
                </div>
                {metrics.conversation_summary && (
                  <div className="mt-3 text-muted-foreground">
                    <span className="font-medium text-foreground">Summary:</span> {metrics.conversation_summary}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-8 pr-4">
              {groupedConversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No message history found.</div>
              ) : (
                groupedConversations.map((convo, idx) => (
                  <div key={convo.id} className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-px bg-border flex-1" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Conversation {groupedConversations.length - idx}
                      </span>
                      <div className="h-px bg-border flex-1" />
                    </div>
                    {convo.messages.map((msg) => {
                      const isSender = msg.from_profile_url && connection.profile_url && 
                        msg.from_profile_url.toLowerCase().includes(connection.profile_url.replace(/\/$/, "").toLowerCase());

                      return (
                        <div key={msg.id} className={`flex flex-col ${isSender ? 'items-start' : 'items-end'}`}>
                          <div className={`max-w-[80%] rounded-lg p-3 text-sm whitespace-pre-wrap ${isSender ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
                            {msg.content}
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">
                            {msg.date ? format(new Date(msg.date), "PPp") : "Unknown Date"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
