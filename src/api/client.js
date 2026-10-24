import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * The one place the app talks to the QueueSmart server (the "Send requests
 * to" arrow in the A1 container diagram). Every function in src/api/ goes
 * through request().
 *
 * Server address, in order:
 *   1. EXPO_PUBLIC_API_URL, e.g. http://192.168.1.20:4000 (needed with --tunnel)
 *   2. web: the same host the page was loaded from, port 4000
 *   3. phone: the laptop running Expo (from the QR code's address), port 4000
 *
 * TODO(auth): the auth teammate adds the login token here and sends it as
 * "Authorization: Bearer <token>" with every request.
 */
const API_PORT = 4000;

function baseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:${API_PORT}`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:${API_PORT}`;
}

export const API_URL = baseUrl();

/**
 * An error response from the server. `code` is the server's error code
 * ('validation', 'name-taken', ...) and `fields` holds per-field messages
 * for a 400.
 */
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? 'Something went wrong.');
    this.status = status;
    this.code = body?.error ?? 'server';
    this.fields = body?.fields ?? null;
  }
}

let authToken = null;

// Called by the store after sign-in and sign-out.
export function setAuthToken(token) {
  authToken = token;
}

export async function request(method, path, body) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, {
      error: 'network',
      message: `Can't reach the QueueSmart server at ${API_URL}. Is it running?`,
    });
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}
