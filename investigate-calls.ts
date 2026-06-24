import { biginRequest } from './src/integrations/bigin/biginClient';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  try {
    console.log("Fetching one Call record with common notes fields...");
    const callsResponse = await biginRequest<any>({
      endpoint: '/Calls',
      method: 'GET',
      queryParams: { 
        per_page: "1",
        fields: "id,Subject,Call_Duration,Call_Start_Time,Call_Type,Description,Call_Result,Call_Agenda,Outcome,Comments,Notes,se_module" 
      }
    });

    console.log("RAW CALL RECORD RESPONSE:");
    console.log(JSON.stringify(callsResponse, null, 2));

  } catch (err: any) {
    console.error("Error investigating Calls:", err.message);
  }
}

main();
