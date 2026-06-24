import { getBiginAccessToken } from './biginAuth';

export const BIGIN_API_BASE = 'https://www.zohoapis.in/bigin/v2';

export interface BiginRequestOptions extends RequestInit {
  endpoint: string;
  queryParams?: Record<string, string>;
}

export async function biginRequest<T>(options: BiginRequestOptions): Promise<T> {
  let token = await getBiginAccessToken();
  let url = `${BIGIN_API_BASE}${options.endpoint}`;

  if (options.queryParams) {
    const params = new URLSearchParams(options.queryParams);
    url += `?${params.toString()}`;
  }

  // ADD THESE LINES
  console.log('====================================');
  console.log('BIGIN REQUEST URL:', url);
  console.log('QUERY PARAMS:', options.queryParams);
  console.log('ENDPOINT:', options.endpoint);
  console.log('====================================');

  const executeRequest = async (accessToken: string) => {
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  };

  let response = await executeRequest(token);

  // Handle 401 Unauthorized (Token expired or invalid)
  if (response.status === 401) {
    token = await getBiginAccessToken(true); // Force refresh
    response = await executeRequest(token);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bigin API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
