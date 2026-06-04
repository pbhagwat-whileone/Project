import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicates() {
  console.log("Fetching all connections...");
  const { data: connections, error } = await supabase
    .from("connections")
    .select("id, user_id, profile_url, first_name, last_name, company, created_at")
    .order("created_at", { ascending: true }); // Ascending so the first one is the oldest

  if (error) {
    console.error("Error fetching connections:", error);
    process.exit(1);
  }

  console.log(`Found ${connections.length} total connections.`);

  const seenProfiles = new Set<string>();
  const seenFallbacks = new Set<string>();
  const toDelete = new Set<string>();

  for (const conn of connections) {
    let isDuplicate = false;

    if (conn.profile_url) {
      const urlKey = `${conn.user_id}:${conn.profile_url.toLowerCase().trim()}`;
      if (seenProfiles.has(urlKey)) {
        isDuplicate = true;
      } else {
        seenProfiles.add(urlKey);
      }
    } else {
      const fallbackKey = `${conn.user_id}:${conn.first_name?.toLowerCase()?.trim() || ""}|${conn.last_name?.toLowerCase()?.trim() || ""}|${conn.company?.toLowerCase()?.trim() || ""}`;
      if (seenFallbacks.has(fallbackKey)) {
        isDuplicate = true;
      } else {
        seenFallbacks.add(fallbackKey);
      }
    }

    if (isDuplicate) {
      toDelete.add(conn.id);
    }
  }

  console.log(`Found ${toDelete.size} duplicate connections to remove.`);

  if (toDelete.size > 0) {
    const idsToDelete = Array.from(toDelete);
    
    // Process in batches of 100 to avoid request URL length limits
    const batchSize = 100;
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      console.log(`Deleting batch ${i / batchSize + 1}...`);
      
      const { error: deleteError } = await supabase
        .from("connections")
        .delete()
        .in("id", batch);
        
      if (deleteError) {
        console.error("Error deleting batch:", deleteError);
      }
    }
    console.log("Cleanup complete!");
  } else {
    console.log("No duplicates found. Database is clean.");
  }
}

cleanupDuplicates();
