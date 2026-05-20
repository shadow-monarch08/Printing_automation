import { useUserPrintStore } from '../stores/useUserPrintStore';
import { useAdminStore } from '../stores/useAdminStore';
import { toast } from '../context/ToastContext';
import type { SSEEvent } from '../types';

class SSEService {
  private eventSource: EventSource | null = null;
  private reconnectTimeout: number | null = null;

  connect() {
    if (this.eventSource) return;

    const baseUrl = import.meta.env.VITE_API_URL || '';
    const url = `${baseUrl}/events`;
    
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const parsed: SSEEvent = JSON.parse(event.data);

        // Dispatch to User Print Store
        const userState = useUserPrintStore.getState();
        if (userState.handleSSEEvent) {
           userState.handleSSEEvent(parsed);
        }

        // Dispatch to Admin Store
        const adminState = useAdminStore.getState();
        if (adminState.handleSSEEvent) {
           adminState.handleSSEEvent(parsed);
        }

        // Handle global toasts for the user's current session
        // Backend sends: { type: "job_completed", id: "...", data: { id: "...", filename: "..." } }
        // Backend sends: { type: "job_failed", id: "...", reason: "..." }
        // Backend sends: { type: "system_critical", message: "..." }
        if (parsed.type === 'system_critical') {
           toast.error('System Critical', parsed.message);
        } else if (parsed.type === 'job_completed') {
           if (userState.jobId === parsed.id) {
             const filename = parsed.data?.filename || parsed.id;
             toast.success('Job Completed', `Job "${filename}" completed successfully`);
           }
        } else if (parsed.type === 'job_failed') {
           if (userState.jobId === parsed.id) {
             toast.error('Job Failed', `Job ${parsed.id} failed: ${parsed.reason || 'Unknown error'}`);
           }
        }

      } catch (e) {
        console.error("Failed to parse SSE message", e);
      }
    };

    this.eventSource.onerror = (err) => {
      console.error("SSE connection error", err);
      this.disconnect();
      // Auto-reconnect after 3 seconds
      this.reconnectTimeout = window.setTimeout(() => this.connect(), 3000);
    };
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

export const sseService = new SSEService();
