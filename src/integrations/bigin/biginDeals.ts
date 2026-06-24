import { biginRequest } from './biginClient';

export interface FetchDealsParams {
  page_token?: string;
  page?: number;
  per_page?: number;
  fields?: string;
}

export async function fetchBiginDeals(params: FetchDealsParams = {}) {
  const queryParams: Record<string, string> = {
    fields: params.fields || 'id,Deal_Name,Stage,Amount,Contact_Name',
  };
  if (params.page_token) queryParams.page_token = params.page_token;
  if (params.page) queryParams.page = params.page.toString();
  if (params.per_page) queryParams.per_page = params.per_page.toString();

  return biginRequest<{ data: any[]; info?: any }>({
    endpoint: '/Pipelines',
    method: 'GET',
    queryParams,
  });
}
