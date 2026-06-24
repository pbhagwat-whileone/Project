import { createAdminClient } from '@/infrastructure/database/supabase/admin';
import { fetchBiginContacts } from '@/integrations/bigin/biginContacts';
import { fetchBiginDeals } from '@/integrations/bigin/biginDeals';
import { fetchBiginTasks, fetchBiginEvents, fetchBiginCalls } from '@/integrations/bigin/biginActivities';
import { fetchBiginNotes } from '@/integrations/bigin/biginNotes';
import { processCRMIntelligence } from './crmIntelligence';

export interface SyncStats {
  contactsProcessed: number;
  emailMatches: number;
  nameMatches: number;
  mappingInserts: number;
  mappingFailures: number;
}

export async function syncBiginData(userId: string) {
  const supabase = createAdminClient();

  const stats: SyncStats = {
    contactsProcessed: 0,
    emailMatches: 0,
    nameMatches: 0,
    mappingInserts: 0,
    mappingFailures: 0
  };

  // 1. Sync Contacts
  console.log('Syncing Contacts...');
  let hasMore = true;
  let page = 1;
  const MAX_CONTACT_PAGES = 8;
  while (hasMore && page <= MAX_CONTACT_PAGES) {
    const response = await fetchBiginContacts({ page, per_page: 200 });
    const contacts = response.data || [];

    for (const contact of contacts) {
      // Upsert into raw cache
      const { error } = await supabase
        .from('bigin_raw_cache')
        .upsert({
          user_id: userId,
          module_name: 'Contacts',
          bigin_record_id: contact.id,
          data: contact
        }, {
          onConflict: 'module_name,bigin_record_id'
        });

      if (error) {
        console.error("CACHE UPSERT ERROR:", error);
        throw error;
      }
      // Match contact
      await matchBiginContact(userId, contact, supabase, stats);
    }

    if (
      response.info?.more_records &&
      page < MAX_CONTACT_PAGES
    ) {
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log('\n--- BIGIN CONTACT MATCHING REPORT ---');
  console.log(`Total Contacts Processed: ${stats.contactsProcessed}`);
  console.log(`Email Matches Succeeded: ${stats.emailMatches}`);
  console.log(`Name/Company Matches Succeeded: ${stats.nameMatches}`);
  console.log(`Total Mapping Inserts: ${stats.mappingInserts}`);
  console.log(`Mapping Insert Failures: ${stats.mappingFailures}`);
  console.log('-------------------------------------\n');

  // 2. Sync other modules
  await syncModule(userId, 'Deals', fetchBiginDeals, supabase, stats);
  await syncModule(userId, 'Tasks', fetchBiginTasks, supabase, stats);
  await syncModule(userId, 'Events', fetchBiginEvents, supabase, stats);
  await syncModule(userId, 'Calls', fetchBiginCalls, supabase, stats);
  await syncModule(userId, 'Notes', fetchBiginNotes, supabase, stats);


  // Update sync state
  const modules = ['Contacts', 'Deals', 'Tasks', 'Events', 'Calls', 'Notes'];
  for (const mod of modules) {
    await supabase.from('bigin_sync_state').upsert({
      user_id: userId,
      module_name: mod,
      last_sync_time: new Date().toISOString()
    }, { onConflict: 'module_name' });
  }

  // Generate CRM Intelligence for all mapped connections
  console.log('Generating CRM Intelligence...');
  const { data: mappings } = await supabase
    .from('bigin_contact_mapping')
    .select('connection_id')
    .eq('user_id', userId);

  if (mappings) {
    const uniqueConnectionIds = Array.from(new Set(mappings.map(m => m.connection_id)));
    for (const connId of uniqueConnectionIds) {
      await processCRMIntelligence(userId, connId);
    }
  }
  console.log('CRM Sync Complete!');
}

async function syncModule(userId: string, moduleName: string, fetchFn: any, supabase: any, stats: SyncStats) {
  console.log(`Syncing ${moduleName}...`);
  let hasMore = true;
  let page = 1;
  while (hasMore && page <= 8) {
    const response = await fetchFn({ page, per_page: 200 });
    const records = response.data || [];

    for (const record of records) {
      await supabase.from('bigin_raw_cache').upsert({
        user_id: userId,
        module_name: moduleName,
        bigin_record_id: record.id,
        data: record
      }, { onConflict: 'module_name,bigin_record_id' });
    }

    if (response.info && response.info.more_records) {
      page++;
    } else {
      hasMore = false;
    }
  }
}

async function matchBiginContact(userId: string, biginContact: any, supabase: any, stats: SyncStats) {
  // Check if mapping already exists
  const { data: existingMapping } = await supabase
    .from('bigin_contact_mapping')
    .select('id')
    .eq('bigin_contact_id', biginContact.id)
    .single();

  if (existingMapping) return; // Already matched

  const email = biginContact.Email;
  const firstName = biginContact.First_Name;
  const lastName = biginContact.Last_Name;
  const company = biginContact.Account_Name?.name; // Bigin usually returns a lookup object for Account_Name

  let connectionId = null;

  // 1. Try by exact email match
  if (email) {
    const { data: matchByEmail } = await supabase
      .from('connections')
      .select('id')
      .eq('user_id', userId)
      .eq('email', email)
      .limit(1)
      .single();

    if (matchByEmail) {
      connectionId = matchByEmail.id;
      console.log(`[MATCH SUCCESS] Found connection by exact email for Bigin Contact: ${email}`);
      stats.emailMatches++;
    }
  }

  // 2. Fallback: Normalized full name + company
  if (!connectionId && firstName && lastName && company) {
    const { data: connections } = await supabase
      .from('connections')
      .select('id, first_name, last_name, company')
      .eq('user_id', userId);

    if (connections) {
      const targetFullName = `${firstName} ${lastName}`.toLowerCase().replace(/\s+/g, ' ').trim();
      const targetCompany = company.toLowerCase().trim();

      const matched = connections.find((c: any) => {
        const cFullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
        const cCompany = (c.company || '').toLowerCase().trim();

        return cFullName === targetFullName && cCompany === targetCompany;
      });

      if (matched) {
        connectionId = matched.id;
        console.log(`[MATCH SUCCESS] Found connection by Name/Company for Bigin Contact: ${firstName} ${lastName} @ ${company}`);
        stats.nameMatches++;
      }
    }
  }

  // If matched, insert mapping
  if (connectionId) {
    const { error } = await supabase.from('bigin_contact_mapping').upsert({
      connection_id: connectionId,
      bigin_contact_id: biginContact.id,
      user_id: userId
    }, { onConflict: 'connection_id,bigin_contact_id' });
    if (error) {
      console.error(`[MAPPING ERROR] Failed to insert mapping for connection ${connectionId} and Bigin Contact ${biginContact.id}:`, error);
      stats.mappingFailures++;
    } else {
      console.log(`[MAPPING SUCCESS] Inserted mapping for connection ${connectionId} -> Bigin Contact ${biginContact.id}`);
      stats.mappingInserts++;
    }
  } else {
    // Optional: Log when no match is found
    // console.log(`[NO MATCH] No Whileone connection found for Bigin Contact ${biginContact.id} (${email || firstName + ' ' + lastName})`);
  }
}
