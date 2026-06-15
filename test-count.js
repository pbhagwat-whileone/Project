const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://imteiqeqkyjbmqrtkslt.supabase.co';
const supabaseKey = 'sb_secret_MuuYNxVtChylxQnpVf9rSQ_m7_nmY46a';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, count, error } = await supabase
    .from('knowledge_chunks')
    .select('id', { count: 'exact' })
    .limit(1);
    
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('knowledge_chunks Count:', count);
    console.log('knowledge_chunks Data:', data);
  }
}

run();
