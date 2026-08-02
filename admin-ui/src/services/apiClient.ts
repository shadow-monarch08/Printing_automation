// src/services/apiClient.ts
import { useUserPrintStore } from '../stores/useUserPrintStore';

const BASE_URL = import.meta.env.VITE_API_URL || '';

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

let isFetchingSession = false;
let refreshSubscribers: ((sessionId: string) => void)[] = [];

function onSessionRefreshed(sessionId: string) {
  refreshSubscribers.forEach(callback => callback(sessionId));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (sessionId: string) => void) {
  refreshSubscribers.push(callback);
}

async function handleResponse<T>(response: Response, requestFn: () => Promise<T>): Promise<T> {
  const contentType = response.headers.get('content-type');
  let data: any;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (response.status === 401) {
    if (data && (data.code === 'SESSION_MISSING' || data.code === 'SESSION_INVALID')) {
      if (!isFetchingSession) {
        isFetchingSession = true;
        try {
          const initRes = await fetch(`${BASE_URL}/session/init`, { method: 'POST' });
          if (!initRes.ok) throw new Error('Failed to init session');
          const initData = await initRes.json();
          
          const newSessionId = initData.sessionId;
          useUserPrintStore.setState({ sessionId: newSessionId });
          
          onSessionRefreshed(newSessionId);
          
          return requestFn();
        } catch (err) {
          isFetchingSession = false;
          throw err;
        } finally {
          isFetchingSession = false;
        }
      } else {
        return new Promise<T>((resolve) => {
          addRefreshSubscriber(() => {
            resolve(requestFn());
          });
        });
      }
    } else {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new Event('auth_unauthorized'));
      throw new Error((data && data.message) || 'Unauthorized');
    }
  }

  if (!response.ok) {
    throw new Error((data && data.message) || response.statusText || 'API Request Failed');
  }

  return data;
}

export const apiClient = {
  get: async <T>(endpoint: string): Promise<T> => {
    const makeRequest = () => fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<T>(await makeRequest(), () => apiClient.get<T>(endpoint));
  },

  post: async <T>(endpoint: string, body?: any, isFormData = false): Promise<T> => {
    const headers = getAuthHeaders();
    if (isFormData) {
      delete (headers as any)['Content-Type'];
    }

    const makeRequest = () => fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: isFormData ? body : JSON.stringify(body),
    });
    return handleResponse<T>(await makeRequest(), () => apiClient.post<T>(endpoint, body, isFormData));
  },

  put: async <T>(endpoint: string, body?: any): Promise<T> => {
    const makeRequest = () => fetch(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse<T>(await makeRequest(), () => apiClient.put<T>(endpoint, body));
  },

  delete: async <T>(endpoint: string): Promise<T> => {
    const makeRequest = () => fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<T>(await makeRequest(), () => apiClient.delete<T>(endpoint));
  },
};
