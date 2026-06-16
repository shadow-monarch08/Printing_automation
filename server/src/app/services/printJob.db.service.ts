import db from '../../infrastructure/database';

export function insertJob(job: {
  id: string;
  sessionId: string;
  filename: string;
  pages: number;
  copies: number;
  colorMode: string;
  duplex: string;
  cost: number;
  submittedAt: string;
}): void {
  const stmt = db.prepare(`
    INSERT INTO print_jobs (id, session_id, filename, pages, copies, color_mode, duplex, cost, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)
  `);
  stmt.run(
    job.id,
    job.sessionId,
    job.filename,
    job.pages,
    job.copies,
    job.colorMode,
    job.duplex,
    job.cost,
    job.submittedAt
  );
}

export function markCompleted(jobId: string, printer: string | null, completedAt: string): void {
  const stmt = db.prepare(`
    UPDATE print_jobs
    SET status = 'completed', executed_by_printer = ?, completed_at = ?
    WHERE id = ?
  `);
  stmt.run(printer, completedAt, jobId);
}

export function markFailed(jobId: string, printer: string | null, errorMessage: string, completedAt: string): void {
  const stmt = db.prepare(`
    UPDATE print_jobs
    SET status = 'failed', executed_by_printer = ?, error_message = ?, completed_at = ?
    WHERE id = ?
  `);
  stmt.run(printer, errorMessage, completedAt, jobId);
}

export function upsertSession(sessionId: string, userAgent?: string, ipAddress?: string): void {
  const stmt = db.prepare(`
    INSERT INTO kiosk_sessions (session_id, user_agent, ip_address)
    VALUES (?, ?, ?)
    ON CONFLICT DO NOTHING
  `);
  stmt.run(sessionId, userAgent || null, ipAddress || null);
}
