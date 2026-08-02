import { useUserPrintStore } from '../stores/useUserPrintStore';
import { useAdminStore } from '../stores/useAdminStore';
import { toast } from '../context/ToastContext';
import type { WebSocketEvent } from '../types';

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    let baseUrl = import.meta.env.VITE_API_URL || '';
    if (!baseUrl) {
      baseUrl = `${window.location.protocol}//${window.location.host}`;
    }
    const wsProtocol = baseUrl.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '');
    const url = `${wsProtocol}//${wsHost}/events`;
    
    this.ws = new WebSocket(url);

    this.ws.onmessage = (messageEvent) => {
      try {
        const { event, data } = JSON.parse(messageEvent.data);
        const normalizedPayload: WebSocketEvent = { type: event, ...data };

        // Dispatch to User Print Store
        const userState = useUserPrintStore.getState();
        if (userState.handleWebSocketEvent) {
           userState.handleWebSocketEvent(normalizedPayload);
        }

        // Dispatch to Admin Store
        const adminState = useAdminStore.getState();
        if (adminState.handleWebSocketEvent) {
           adminState.handleWebSocketEvent(normalizedPayload);
        }

        // Handle global toasts for the user's current session
        if (normalizedPayload.type === 'system_critical') {
           toast.error('System Critical', normalizedPayload.message);
        } else if (normalizedPayload.type === 'job_completed') {
           if (userState.jobId === normalizedPayload.id) {
             const filename = normalizedPayload.data?.filename || normalizedPayload.id;
             toast.success('Job Completed', `Job "${filename}" completed successfully`);
           }
        } else if (normalizedPayload.type === 'job_failed') {
           const isCustomerJob = userState.jobId === normalizedPayload.id || 
             (userState.jobs && userState.jobs.some((j: any) => j.id === normalizedPayload.id));
           if (isCustomerJob) {
             const failureReason = normalizedPayload.reason || (normalizedPayload as any).error || 'Unknown error';
             toast.error('Print Job Failed', `Your document failed to print: ${failureReason}`);
           }
        } else if (normalizedPayload.type === 'printer_quarantined') {
           toast.error('Printer Quarantined', normalizedPayload.message);
        } else if (normalizedPayload.type === 'queue_paused') {
           toast.error('Queue Paused', normalizedPayload.message);
        } else if (normalizedPayload.type === 'queue_resumed') {
           toast.success('Queue Resumed', normalizedPayload.message);
        }

      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket connection error", err);
      // onerror is usually followed by onclose
    };

    this.ws.onclose = () => {
      this.disconnect();
      // Auto-reconnect after 3 seconds
      this.reconnectTimeout = window.setTimeout(() => this.connect(), 3000);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

export const websocketService = new WebSocketService();