// src/services/pollingApiClient.ts
import { useUserPrintStore } from '../stores/useUserPrintStore';
import { mapApiError } from './errorMapper';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export interface PollingApiOptions {
  isFormData?: boolean;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Inject kiosk session id only when not authenticated as admin
    const userState = useUserPrintStore.getState();
    if (userState.sessionId) {
      (headers as any)['X-Session-ID'] = userState.sessionId;
    }
  }

  return headers;
}

// Single-shot state to prevent duplicate toast triggers during continuous status polling
let isOnboardingErrorDispatched = false;

export function resetPollingErrorState() {
  isOnboardingErrorDispatched = false;
}

function dispatchPollingDomainError(data: any, status: number = 500) {
  if (isOnboardingErrorDispatched) return;
  isOnboardingErrorDispatched = true;

  const { title, description } = mapApiError(data);
  window.dispatchEvent(
    new CustomEvent('global_api_error', {
      detail: {
        title,
        description,
        status,
        code: data?.code || data?.error?.code || 'WIFI_CONNECTION_FAILED',
      },
    })
  );
}

async function handlePollingResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  let data: any;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  // Intercept explicit server domain failure payloads during onboarding/wifi polling
  if (data && typeof data === 'object' && data.status === 'failed') {
    dispatchPollingDomainError(data, response.status);
  } else if (data && typeof data === 'object' && (data.status === 'success' || data.status === 'connecting')) {
    // Reset error trigger state when status recovers or progresses
    isOnboardingErrorDispatched = false;
  }

  return data;
}

/**
 * Dedicated Polling API Client
 * Intercepts explicit server domain failure payloads (e.g. status: 'failed') and dispatches
 * a single global error toast via mapApiError.
 * Ignores raw network drops / TypeError fetch so network drops do not spam toasts.
 */
export const pollingApiClient = {
  get: async <T>(endpoint: string): Promise<T> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      return handlePollingResponse<T>(response);
    } catch (err: any) {
      // Rejects quietly on network drop without triggering network error toasts
      throw err;
    }
  },

  post: async <T>(endpoint: string, body?: any, options?: PollingApiOptions): Promise<T> => {
    // Reset error state on new submission
    resetPollingErrorState();

    const headers = getAuthHeaders();
    if (options?.isFormData) {
      delete (headers as any)['Content-Type'];
    }

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: options?.isFormData ? body : JSON.stringify(body),
      });
      return handlePollingResponse<T>(response);
    } catch (err: any) {
      throw err;
    }
  },
};
