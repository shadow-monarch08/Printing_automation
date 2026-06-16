import db from '../../infrastructure/database';

export function getFinancialSummary(startDate: string, endDate: string) {
  const row = db.prepare(`
    SELECT 
      COUNT(*) as totalJobs,
      SUM(CASE WHEN status='completed' THEN cost ELSE 0 END) as totalRevenue,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completedJobs,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failedJobs
    FROM print_jobs 
    WHERE submitted_at BETWEEN ? AND ?
  `).get(startDate, endDate) as any;

  return {
    totalRevenue: row.totalRevenue || 0,
    totalJobs: row.totalJobs || 0,
    completedJobs: row.completedJobs || 0,
    failedJobs: row.failedJobs || 0,
    avgCostPerJob: row.completedJobs > 0 ? (row.totalRevenue / row.completedJobs) : 0
  };
}

export function getRevenueTrend(startDate: string, endDate: string) {
  return db.prepare(`
    SELECT 
      date(submitted_at) as date, 
      SUM(cost) as revenue, 
      COUNT(*) as jobCount 
    FROM print_jobs 
    WHERE status = 'completed' AND submitted_at BETWEEN ? AND ? 
    GROUP BY date(submitted_at) 
    ORDER BY date ASC
  `).all(startDate, endDate);
}

export function getColorSplit(startDate: string, endDate: string) {
  const rows = db.prepare(`
    SELECT color_mode, SUM(cost) as revenue, COUNT(*) as jobs 
    FROM print_jobs 
    WHERE status = 'completed' AND submitted_at BETWEEN ? AND ? 
    GROUP BY color_mode
  `).all(startDate, endDate) as any[];

  let colorRevenue = 0, colorJobs = 0, bwRevenue = 0, bwJobs = 0;
  
  for (const row of rows) {
    if (row.color_mode === 'color') {
      colorRevenue += row.revenue || 0;
      colorJobs += row.jobs;
    } else {
      bwRevenue += row.revenue || 0;
      bwJobs += row.jobs;
    }
  }

  return { colorRevenue, colorJobs, bwRevenue, bwJobs };
}

export function getFleetTelemetry(startDate: string, endDate: string) {
  const completedRows = db.prepare(`
    SELECT executed_by_printer, SUM(pages * copies) as totalPages, COUNT(*) as completedJobs 
    FROM print_jobs 
    WHERE status = 'completed' AND executed_by_printer IS NOT NULL AND submitted_at BETWEEN ? AND ? 
    GROUP BY executed_by_printer
  `).all(startDate, endDate) as any[];

  const failedRows = db.prepare(`
    SELECT executed_by_printer, COUNT(*) as failedJobs 
    FROM print_jobs 
    WHERE status = 'failed' AND executed_by_printer IS NOT NULL AND submitted_at BETWEEN ? AND ? 
    GROUP BY executed_by_printer
  `).all(startDate, endDate) as any[];

  const merged: Record<string, any> = {};

  for (const row of completedRows) {
    merged[row.executed_by_printer] = {
      printer: row.executed_by_printer,
      totalPages: row.totalPages || 0,
      completedJobs: row.completedJobs || 0,
      failedJobs: 0,
      errorRate: 0
    };
  }

  for (const row of failedRows) {
    if (!merged[row.executed_by_printer]) {
      merged[row.executed_by_printer] = {
        printer: row.executed_by_printer,
        totalPages: 0,
        completedJobs: 0,
        failedJobs: 0,
        errorRate: 0
      };
    }
    merged[row.executed_by_printer].failedJobs = row.failedJobs || 0;
  }

  return Object.values(merged).map((stats: any) => {
    const total = stats.completedJobs + stats.failedJobs;
    stats.errorRate = total > 0 ? (stats.failedJobs / total) * 100 : 0;
    return stats;
  });
}

export function getJobArchive(filters: { startDate: string; endDate: string; status?: string; printer?: string; page: number; limit: number; }) {
  let whereClause = "WHERE submitted_at BETWEEN ? AND ?";
  const params: any[] = [filters.startDate, filters.endDate];

  if (filters.status) {
    whereClause += " AND status = ?";
    params.push(filters.status);
  }

  if (filters.printer) {
    whereClause += " AND executed_by_printer = ?";
    params.push(filters.printer);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM print_jobs ${whereClause}`).get(...params) as any;
  const total = countRow.total || 0;

  const offset = (filters.page - 1) * filters.limit;
  
  const jobs = db.prepare(`
    SELECT * FROM print_jobs 
    ${whereClause} 
    ORDER BY submitted_at DESC 
    LIMIT ? OFFSET ?
  `).all(...params, filters.limit, offset);

  return {
    jobs,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit)
  };
}

export function getJobArchiveCSV(filters: { startDate: string; endDate: string; status?: string; printer?: string; }) {
  let whereClause = "WHERE submitted_at BETWEEN ? AND ?";
  const params: any[] = [filters.startDate, filters.endDate];

  if (filters.status) {
    whereClause += " AND status = ?";
    params.push(filters.status);
  }

  if (filters.printer) {
    whereClause += " AND executed_by_printer = ?";
    params.push(filters.printer);
  }

  const jobs = db.prepare(`SELECT * FROM print_jobs ${whereClause} ORDER BY submitted_at DESC`).all(...params) as any[];

  if (jobs.length === 0) return "No data available";

  const headers = Object.keys(jobs[0]).join(",");
  const rows = jobs.map(job => Object.values(job).map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));
  
  return [headers, ...rows].join("\n");
}
