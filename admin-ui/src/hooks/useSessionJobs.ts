import { useEffect } from 'react';
import { useUserPrintStore } from '../stores/useUserPrintStore';
import type { BackendJob } from '../types';

export function useSessionJobs(pollIntervalMs = 5000): BackendJob[] {
  const { jobs, fetchJobs, sessionId, jobStatus } = useUserPrintStore();

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchJobs, sessionId, jobStatus, pollIntervalMs]);

  return jobs;
}
