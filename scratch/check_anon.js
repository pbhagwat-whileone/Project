const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://imteiqeqkyjbmqrtkslt.supabase.co";
const supabaseAnonKey = "sb_publishable_MFuQKmnmkgIZKd4ayPodJg_J-tjHu9j";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const id = "d9a177d2-831e-4931-ba63-e4d2c417d1cb";
  
  const { data, error } = await supabase
    .from("connections")
    .select("*")
    .eq("id", id);
    
  if (error) {
    console.error("Error fetching connection:", error);
  } else {
    console.log("Count in DB for ID:", data.length);
  }
}

check();
