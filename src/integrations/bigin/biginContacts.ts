import { biginRequest } from './biginClient';

export interface FetchContactsParams {
  page_token?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  fields?: string;
}

export async function fetchBiginContacts(params: FetchContactsParams = {}) {
  const queryParams: Record<string, string> = {
    fields: params.fields || 'id,Email,First_Name,Last_Name,Account_Name',
  };
  if (params.page_token) queryParams.page_token = params.page_token;
  if (params.page) queryParams.page = params.page.toString();
  if (params.per_page) queryParams.per_page = params.per_page.toString();

  return biginRequest<{ data: any[]; info?: any }>({
    endpoint: '/Contacts',
    method: 'GET',
    queryParams,
  });
}
