require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const id = "d9a177d2-831e-4931-ba63-e4d2c417d1cb";
  
  const { data, error } = await supabase
    .from("connections")
    .select("*")
    .eq("id", id);
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Count in DB for ID:", data.length);
    console.log("Data:", data);
  }
}

check();
