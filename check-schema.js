const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const cleanLine = line.replace(/\r/g, '');
  const [key, ...val] = cleanLine.split('=');
  if (key && val.length > 0) {
    env[key.trim()] = val.join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("Checking if connection_owner_name exists...");
  const { data, error } = await supabase.from('connections').select('id, company, connection_owner_name').limit(1);
  if (error) {
    console.error("SCHEMA ERROR:", error);
  } else {
    console.log("SCHEMA OK. Found row:", data);
  }
  
  console.log("Getting 1 row from connections...");
  const res = await supabase.from('connections').select('*').limit(1);
  console.log(res.data ? res.data[0] : res.error);
}

check();
