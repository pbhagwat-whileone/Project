import { env } from 'process';

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getBiginAccessToken(forceRefresh = false): Promise<string> {
  const clientId = process.env.BIGIN_CLIENT_ID;
  const clientSecret = process.env.BIGIN_CLIENT_SECRET;
  const refreshToken = process.env.BIGIN_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Bigin credentials are not fully configured in environment variables.');
  }

  // Use cached token if valid and not forcing a refresh
  if (!forceRefresh && cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  // Refresh the token
  const tokenUrl = 'https://accounts.zoho.in/oauth/v2/token';
  const params = new URLSearchParams();
  params.append('refresh_token', refreshToken);
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'refresh_token');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    body: params,
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to refresh Bigin access token: ${errorData}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Bigin Auth Error: ${data.error}`);
  }

  cachedAccessToken = data.access_token;
  // Bigin tokens typically expire in 3600 seconds (1 hour)
  const expiresIn = data.expires_in || 3600;
  tokenExpiresAt = Date.now() + (expiresIn - 300) * 1000; // Buffer of 5 minutes

  return cachedAccessToken as string;
}
