import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient, requireUser } from "@/lib/supabase/server";
import { fetchAllRecords } from "@/utils/supabase-utils";
import { generateWithFallback } from "@/ai/generation";

type MessageRow = {
  FROM?: string;
  "SENDER PROFILE URL"?: string;
  TO?: string;
  "RECIPIENT PROFILE URLS"?: string;
  DATE?: string;
  CONTENT?: string;
  "CONVERSATION ID"?: string;
};

function normalizeUrl(url: string | undefined): string | null {
  if (!url) return null;
  
  let urlStr = url.trim();
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    urlStr = "https://" + urlStr;
  }
  
  try {
    const parsed = new URL(urlStr);
    return parsed.pathname.replace(/\/$/, "").toLowerCase();
  } catch {
    return urlStr.replace(/\/$/, "").toLowerCase();
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<MessageRow>(text, {
      header: true,
      skipEmptyLines: true,
    });

    console.log("CSV HEADERS:", parsed.meta.fields);
    console.log("TOTAL PARSED ROWS:", parsed.data.length);
    console.log("FIRST 5 ROWS:", parsed.data.slice(0, 5));

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { error: parsed.errors[0].message },
        { status: 400 }
      );
    }

    console.log("ROWS BEFORE FILTER:", parsed.data.length);
    const rows = parsed.data.filter(
      (row) => row.DATE && row.CONTENT && row["CONVERSATION ID"]
    );
    console.log("ROWS AFTER FILTER:", rows.length);

    const rejected = parsed.data.filter(
      (row) => !(row.DATE && row.CONTENT && row["CONVERSATION ID"])
    );
    console.log("FIRST 10 REJECTED ROWS:", rejected.slice(0, 10));

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    // 1. Save all messages to linkedin_messages
    const parsedCount = rows.length;
    let insertedCount = 0;
    let skippedCount = 0;

    const messages = rows.map((row) => {
      const dateStr = new Date(row.DATE!).toISOString();
      const content = row.CONTENT || "";
      const conversation_id = row["CONVERSATION ID"]!;
      const from_name = row["FROM"] || "";
      const to_name = row["TO"] || "";
      const from_url = row["SENDER PROFILE URL"] || "";
      const to_url = row["RECIPIENT PROFILE URLS"] || "";

      const key = conversation_id + from_url + to_url + dateStr + content;
      const message_hash = createHash("sha256").update(key).digest("hex");

      return {
        user_id: user.id,
        conversation_id,
        from_profile_url: from_url || null,
        to_profile_url: to_url || null,
        from_name: from_name || null,
        to_name: to_name || null,
        date: dateStr,
        content,
        message_hash
      };
    });

    const existingRecordsQuery = supabase
      .from("linkedin_messages")
      .select("message_hash, from_name")
      .eq("user_id", user.id);
    const existingRecords = await fetchAllRecords<{ message_hash: string; from_name: string | null }>(existingRecordsQuery);
    
    // Map of message_hash -> from_name
    const existingMap = new Map<string, string | null>();
    existingRecords?.forEach((r) => existingMap.set(r.message_hash, r.from_name));

    const newMessagesToInsert = [];
    for (const msg of messages) {
      const existingFromName = existingMap.get(msg.message_hash);
      
      // Skip if hash exists AND we already have a from_name for it.
      // If from_name is null, we want to upsert to backfill it.
      if (existingMap.has(msg.message_hash) && existingFromName !== null) {
        skippedCount++;
      } else {
        newMessagesToInsert.push(msg);
        existingMap.set(msg.message_hash, msg.from_name);
      }
    }

    console.log("FIRST GENERATED MESSAGE_HASH:", messages[0]?.message_hash);
    console.log("ROWS BEFORE DEDUPE:", messages.length);
    console.log("ROWS AFTER DEDUPE:", newMessagesToInsert.length);

    insertedCount = newMessagesToInsert.length;

    console.log("ROWS READY FOR INSERT:", newMessagesToInsert.length);

    const BATCH_SIZE = 500;
    for (let i = 0; i < newMessagesToInsert.length; i += BATCH_SIZE) {
      const batch = newMessagesToInsert.slice(i, i + BATCH_SIZE);
      const result = await supabase.from("linkedin_messages").upsert(batch, {
        onConflict: "user_id,message_hash"
      });
      console.log("UPSERT ERROR:", result.error);
    }

    // DO NOT return early if insertedCount === 0. We still need to process metrics.
    
    // 2. Map messages to connections using ALL messages, not just newly inserted ones
    const messagesToProcess = messages;
    const connectionsQuery = supabase
      .from("connections")
      .select("id, profile_url")
      .eq("user_id", user.id)
      .not("profile_url", "is", null);

    const connections = await fetchAllRecords(connectionsQuery);
    if (!connections || connections.length === 0) {
      const payload = {
        parsed: parsedCount,
        inserted: insertedCount,
        skipped: skippedCount,
        metricsUpdated: 0,
      };
      console.log("RESPONSE PAYLOAD (Early Return):", payload);
      return NextResponse.json(payload);
    }

    const connectionMap = new Map<string, string>(); // url -> connection_id
    for (const c of connections) {
      if (c.profile_url) {
        const url = normalizeUrl(c.profile_url);
        if (url) connectionMap.set(url, c.id);
      }
    }

    // Group messages by connection_id
    const messagesByConnection = new Map<string, typeof messagesToProcess>();

    for (const msg of messagesToProcess) {
      const senderUrl = normalizeUrl(msg.from_profile_url || "");
      const recipientUrls = (msg.to_profile_url || "")
        .split(",")
        .map((u) => normalizeUrl(u.trim()))
        .filter(Boolean);

      const matchedConnectionIds = new Set<string>();

      if (senderUrl && connectionMap.has(senderUrl)) {
        matchedConnectionIds.add(connectionMap.get(senderUrl)!);
      }
      for (const url of recipientUrls) {
        if (url && connectionMap.has(url)) {
          matchedConnectionIds.add(connectionMap.get(url)!);
        }
      }

      for (const connId of matchedConnectionIds) {
        if (!messagesByConnection.has(connId)) {
          messagesByConnection.set(connId, []);
        }
        messagesByConnection.get(connId)!.push(msg);
      }
    }

    // 3. Calculate metrics and generate summaries
    let metricsUpdated = 0;

    for (const [connectionId, msgs] of messagesByConnection.entries()) {
      if (msgs.length === 0) continue;

      const messageCount = msgs.length;
      const conversationIds = new Set(msgs.map((m) => m.conversation_id));
      const conversationCount = conversationIds.size;

      const dates = msgs.map((m) => new Date(m.date).getTime());
      const firstContactDate = new Date(Math.min(...dates)).toISOString();
      const lastContactDate = new Date(Math.max(...dates)).toISOString();

      // AI summarization is deferred to the UI via the /api/connections/[id]/summarize endpoint
      // We only upsert the raw metrics (counts and dates) here.
      const relationshipScore = messageCount * 1 + conversationCount * 5;

      const { error: upsertError } = await supabase
        .from("connection_relationship_metrics")
        .upsert(
          {
            connection_id: connectionId,
            user_id: user.id,
            message_count: messageCount,
            conversation_count: conversationCount,
            first_contact_date: firstContactDate,
            last_contact_date: lastContactDate,
            relationship_score: relationshipScore,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "connection_id" }
        );

      if (!upsertError) {
        metricsUpdated++;
      } else {
        console.error("Metrics upsert error:", upsertError);
      }
    }

    const payload = {
      parsed: parsedCount,
      inserted: insertedCount,
      skipped: skippedCount,
      metricsUpdated,
      totalMatchedConnections: messagesByConnection.size,
    };
    console.log("== METRICS GENERATION DIAGNOSTICS ==");
    console.log("TOTAL MESSAGES PROCESSED:", messagesToProcess.length);
    console.log("TOTAL CONNECTIONS IN DB:", connections.length);
    console.log("MATCHED CONNECTIONS FOR METRICS:", messagesByConnection.size);
    console.log("METRIC ROWS GENERATED/UPSERTED:", metricsUpdated);
    console.log("RESPONSE PAYLOAD:", payload);

    return NextResponse.json(payload);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
