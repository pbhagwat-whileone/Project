import { biginRequest } from './biginClient';

export interface FetchActivitiesParams {
  page_token?: string;
  page?: number;
  per_page?: number;
  fields?: string;
}

export async function fetchBiginTasks(params: FetchActivitiesParams = {}) {
  const queryParams: Record<string, string> = {
    fields: params.fields || 'id,Subject,Status,Created_Time,Contact_Name,Who_Id,What_Id,Parent_Id,se_module',
  };
  if (params.page_token) queryParams.page_token = params.page_token;
  if (params.page) queryParams.page = params.page.toString();
  if (params.per_page) queryParams.per_page = params.per_page.toString();

  return biginRequest<{ data: any[]; info?: any }>({
    endpoint: '/Tasks',
    method: 'GET',
    queryParams,
  });
}

export async function fetchBiginEvents(params: FetchActivitiesParams = {}) {
  const queryParams: Record<string, string> = {
    fields: params.fields || 'id,Event_Title,Start_DateTime,Created_Time,Contact_Name,Who_Id,What_Id,Parent_Id,se_module',
  };
  if (params.page_token) queryParams.page_token = params.page_token;
  if (params.page) queryParams.page = params.page.toString();
  if (params.per_page) queryParams.per_page = params.per_page.toString();

  return biginRequest<{ data: any[]; info?: any }>({
    endpoint: '/Events',
    method: 'GET',
    queryParams,
  });
}

export async function fetchBiginCalls(params: FetchActivitiesParams = {}) {
  const queryParams: Record<string, string> = {
    fields: params.fields || 'id,Subject,Call_Type,Call_Start_Time,Call_Duration,Description,Call_Result,Call_Agenda,Contact_Name,Who_Id,What_Id,Parent_Id',
  };
  if (params.page_token) queryParams.page_token = params.page_token;
  if (params.page) queryParams.page = params.page.toString();
  if (params.per_page) queryParams.per_page = params.per_page.toString();

  return biginRequest<{ data: any[]; info?: any }>({
    endpoint: '/Calls',
    method: 'GET',
    queryParams,
  });
}
