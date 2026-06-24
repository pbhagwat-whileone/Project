import { createAdminClient } from './src/infrastructure/database/supabase/admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const supabase = createAdminClient();
  
  const modules = ['Deals', 'Notes', 'Tasks', 'Events', 'Calls'];
  
  for (const mod of modules) {
    const { data } = await supabase
      .from('bigin_raw_cache')
      .select('data')
      .eq('module_name', mod)
      .limit(3);
      
    console.log(`\n=== ${mod} Relationship Fields ===`);
    if (!data || data.length === 0) {
      console.log('No records found.');
      continue;
    }
    
    data.forEach((row, i) => {
      const d = row.data;
      const links = {
        Contact_Name: d.Contact_Name,
        Who_Id: d.Who_Id,
        What_Id: d.What_Id,
        Parent_Id: d.Parent_Id,
        se_module: d.se_module,
        Related_To: d.Related_To,
        $related_module: d['$related_module'],
        Pipeline: d.Pipeline,
        id: d.id
      };
      console.log(`Record ${i + 1}:`, JSON.stringify(links, null, 2));
    });
  }
}

main();
