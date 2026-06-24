import { NextResponse } from 'next/server';
import { syncBiginData } from '@/domains/crm/crmSync';
import { createAdminClient } from '@/infrastructure/database/supabase/admin';

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();

    // TEST SUPABASE CONNECTION
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    console.log("TEST DATA:", data);
    console.log("TEST ERROR:", error);

    // We need a userId to sync for. We can either pass it in body, or just pick the first user for debug.
    const body = await req.json().catch(() => ({}));
    let userId = body.userId;

    if (!userId) {
      // Just pick the first profile for debug
      const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();
      if (!profile) {
        return NextResponse.json({ error: 'No users found in database to sync for.' }, { status: 400 });
      }
      userId = profile.id;
    }

    console.log(`Starting Bigin Sync for user: ${userId}`);
    await syncBiginData(userId);
    console.log(`Bigin Sync completed for user: ${userId}`);

    // Return counts for verification
    const { count: contactsCount } = await supabase.from('bigin_raw_cache').select('*', { count: 'exact', head: true }).eq('module_name', 'Contacts').eq('user_id', userId);
    const { count: dealsCount } = await supabase.from('bigin_raw_cache').select('*', { count: 'exact', head: true }).eq('module_name', 'Deals').eq('user_id', userId);
    const { count: notesCount } = await supabase.from('bigin_raw_cache').select('*', { count: 'exact', head: true }).eq('module_name', 'Notes').eq('user_id', userId);
    const { count: tasksCount } = await supabase.from('bigin_raw_cache').select('*', { count: 'exact', head: true }).eq('module_name', 'Tasks').eq('user_id', userId);
    const { count: eventsCount } = await supabase.from('bigin_raw_cache').select('*', { count: 'exact', head: true }).eq('module_name', 'Events').eq('user_id', userId);
    const { count: callsCount } = await supabase.from('bigin_raw_cache').select('*', { count: 'exact', head: true }).eq('module_name', 'Calls').eq('user_id', userId);
    const { count: matchedCount } = await supabase.from('bigin_contact_mapping').select('*', { count: 'exact', head: true }).eq('user_id', userId);

    const unmatchedCount = (contactsCount || 0) - (matchedCount || 0);

    return NextResponse.json({
      success: true,
      userId,
      counts: {
        contacts: contactsCount || 0,
        deals: dealsCount || 0,
        notes: notesCount || 0,
        activities: (tasksCount || 0) + (eventsCount || 0) + (callsCount || 0)
      },
      matching: {
        matched: matchedCount || 0,
        unmatched: unmatchedCount
      }
    });

  } catch (error: any) {
    console.error('Bigin Sync Debug Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
