import { createClient } from "@supabase/supabase-js";
import { findBestContact } from "../src/utils/company-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: connections, error } = await supabase
    .from("connections")
    .select("*");

  if (error) {
    console.error("DB Error:", error);
    return;
  }

  console.log("SEARCH QUERY: SiPearl");
  console.log("TOTAL CONNECTIONS:", connections?.length);

  const siPearlRecords = (connections ?? []).filter(
    c => c.company === "SiPearl"
  );
  console.log("SIPEARL RECORDS FOUND:", siPearlRecords.length);
  console.log("SIPEARL RECORDS:", siPearlRecords);

  const siPearlExists = (connections ?? []).some(
    c => c.company === "SiPearl"
  );
  console.log("SIPEARL EXISTS:", siPearlExists);

  const contact = findBestContact("SiPearl", connections ?? []);
  console.log("FINAL RETURNED CONTACT:", contact);
}

run().catch(console.error);
