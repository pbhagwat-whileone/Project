require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const query = supabase.from("connections").select("id").order("created_at", { ascending: false }).order("id", { ascending: true });
  
  const q1 = query.range(0, 1);
  console.log("URL1:", q1.url.toString(), "Headers:", q1.headers);
  const res1 = await q1;
  
  const q2 = query.range(2, 3);
  console.log("URL2:", q2.url.toString(), "Headers:", q2.headers);
  const res2 = await q2;
  
  console.log("Res1 === Res2?", res1 === res2);
}

test();
