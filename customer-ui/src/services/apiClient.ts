// src/services/apiClient.ts
import { useUserPrintStore } from '../stores/useUserPrintStore';
import { mapApiError } from './errorMapper';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export interface ApiOptions {
  skipGlobalError?: boolean;
  isFormData?: boolean;
}

function getAuthHeaders(url?: string): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Always attach kiosk session id when available
  const userState = useUserPrintStore.getState();
  if (userState.sessionId) {
    (headers as any)['X-Session-ID'] = userState.sessionId;
  }

  // Only supply admin Bearer token for admin routes or when explicitly not in kiosk flow
  const isAdminPath = typeof window !== 'undefined' && (window.location.pathname.startsWith('/admin') || (url && url.includes('/admin')));
  if (token && (isAdminPath || !userState.sessionId)) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

let isFetchingSession = false;
let refreshSubscribers: ((sessionId: string) => void)[] = [];

// Global Systemic Network Error Lock
let isNetworkErrorTriggered = false;

function onSessionRefreshed(sessionId: string) {
  refreshSubscribers.forEach((callback) => callback(sessionId));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (sessionId: string) => void) {
  refreshSubscribers.push(callback);
}

function dispatchGlobalError(data: any, status?: number) {
  const code = data?.error?.code || data?.code || 'INTERNAL_SERVER_ERROR';

  // Global Network Error Debounce (Single-shot toast when server turns off / network drops)
  if (code === 'NETWORK_ERROR') {
    if (isNetworkErrorTriggered) {
      return;
    }
    isNetworkErrorTriggered = true;
  }

  const { title, description } = mapApiError(data);
  window.dispatchEvent(
    new CustomEvent('global_api_error', {
      detail: {
        title,
        description,
        status: status || 500,
        code,
      },
    })
  );
}

async function handleResponse<T>(
  response: Response,
  requestFn: (newSessionId?: string) => Promise<T>,
  options?: ApiOptions
): Promise<T> {
  const contentType = response.headers.get('content-type');
  let data: any;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  const errCode = data?.error?.code || data?.code;

  if (response.status === 401) {
    if (data && (errCode === 'SESSION_MISSING' || errCode === 'SESSION_INVALID')) {
      if (!isFetchingSession) {
        isFetchingSession = true;
        try {
          const initRes = await fetch(`${BASE_URL}/session/init`, { method: 'POST' });
          if (!initRes.ok) throw new Error('Failed to init session');
          const initData = await initRes.json();

          const newSessionId = initData.sessionId;
          useUserPrintStore.setState({ sessionId: newSessionId });

          onSessionRefreshed(newSessionId);

          return requestFn(newSessionId);
        } catch (err) {
          isFetchingSession = false;
          if (!options?.skipGlobalError) {
            dispatchGlobalError(
              { code: 'SESSION_INVALID', message: 'Kiosk session initialization failed.' },
              401
            );
          }
          throw err;
        } finally {
          isFetchingSession = false;
        }
      } else {
        return new Promise<T>((resolve) => {
          addRefreshSubscriber((newSessionId) => {
            resolve(requestFn(newSessionId));
          });
        });
      }
    } else {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new Event('auth_unauthorized'));
      if (!options?.skipGlobalError) {
        dispatchGlobalError(data, 401);
      }
      throw new Error((data && (data.error?.message || data.message)) || 'Unauthorized');
    }
  }

  if (!response.ok) {
    if (!options?.skipGlobalError) {
      dispatchGlobalError(data, response.status);
    }
    const message = (data && (data.error?.message || data.message)) || response.statusText || 'API Request Failed';
    throw new Error(message);
  }

  // Reset global network error lock as soon as any API request succeeds
  isNetworkErrorTriggered = false;

  return data;
}

export const apiClient = {
  get: async <T>(endpoint: string, options?: ApiOptions): Promise<T> => {
    const makeRequest = () =>
      fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: getAuthHeaders(endpoint),
      });

    try {
      const response = await makeRequest();
      return handleResponse<T>(
        response,
        (newSessionId) =>
          apiClient.get<T>(
            newSessionId && endpoint.includes('sessionId=')
              ? endpoint.replace(/sessionId=[^&]+/, `sessionId=${newSessionId}`)
              : endpoint,
            options
          ),
        options
      );
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message?.includes('fetch')) {
        if (!options?.skipGlobalError) {
          dispatchGlobalError({ code: 'NETWORK_ERROR', message: 'Unable to connect to the print server.' }, 0);
        }
      }
      throw err;
    }
  },

  post: async <T>(endpoint: string, body?: any, isFormDataOrOptions: boolean | ApiOptions = false): Promise<T> => {
    const options: ApiOptions =
      typeof isFormDataOrOptions === 'boolean'
        ? { isFormData: isFormDataOrOptions }
        : isFormDataOrOptions;

    const headers = getAuthHeaders(endpoint);
    if (options.isFormData) {
      delete (headers as any)['Content-Type'];
    }

    const makeRequest = () =>
      fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: options.isFormData ? body : JSON.stringify(body),
      });

    try {
      const response = await makeRequest();
      return handleResponse<T>(response, () => apiClient.post<T>(endpoint, body, options), options);
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message?.includes('fetch')) {
        if (!options?.skipGlobalError) {
          dispatchGlobalError({ code: 'NETWORK_ERROR', message: 'Unable to connect to the print server.' }, 0);
        }
      }
      throw err;
    }
  },

  put: async <T>(endpoint: string, body?: any, options?: ApiOptions): Promise<T> => {
    const makeRequest = () =>
      fetch(`${BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: getAuthHeaders(endpoint),
        body: JSON.stringify(body),
      });

    try {
      const response = await makeRequest();
      return handleResponse<T>(response, () => apiClient.put<T>(endpoint, body, options), options);
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message?.includes('fetch')) {
        if (!options?.skipGlobalError) {
          dispatchGlobalError({ code: 'NETWORK_ERROR', message: 'Unable to connect to the print server.' }, 0);
        }
      }
      throw err;
    }
  },

  delete: async <T>(endpoint: string, options?: ApiOptions): Promise<T> => {
    const makeRequest = () =>
      fetch(`${BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: getAuthHeaders(endpoint),
      });

    try {
      const response = await makeRequest();
      return handleResponse<T>(response, () => apiClient.delete<T>(endpoint, options), options);
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message?.includes('fetch')) {
        if (!options?.skipGlobalError) {
          dispatchGlobalError({ code: 'NETWORK_ERROR', message: 'Unable to connect to the print server.' }, 0);
        }
      }
      throw err;
    }
  },
};
