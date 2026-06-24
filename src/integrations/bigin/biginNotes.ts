import { biginRequest } from './biginClient';

export interface FetchNotesParams {
  page_token?: string;
  page?: number;
  per_page?: number;
  fields?: string;
}

export async function fetchBiginNotes(params: FetchNotesParams = {}) {
  const queryParams: Record<string, string> = {
    fields: params.fields || 'id,Note_Title,Note_Content,Created_Time,Parent_Id,se_module',
  };
  if (params.page_token) queryParams.page_token = params.page_token;
  if (params.page) queryParams.page = params.page.toString();
  if (params.per_page) queryParams.per_page = params.per_page.toString();

  return biginRequest<{ data: any[]; info?: any }>({
    endpoint: '/Notes',
    method: 'GET',
    queryParams,
  });
}
