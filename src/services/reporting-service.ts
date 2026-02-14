// Reporting Service for Usage Reports and Dashboard Generation
import { logger } from '../utils/logger';
import { AnalyticsService, AnalyticsMetrics } from './analytics-service';
import { Language, ContentType } from '../models/common';

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';
export type ReportFormat = 'json' | 'csv' | 'pdf';

export interface UsageReport {
  reportId: string;
  reportType: ReportType;
  generatedAt: Date;
  startDate: Date;
  endDate: Date;
  summary: {
    totalScans: number;
    totalViews: number;
    totalInteractions: number;
    uniqueUsers: number;
    uniqueSessions: number;
    averageSessionDuration: number;
  };
  topArtifacts: Array<{ artifactId: string; scans: number; views: number }>;
  topSites: Array<{ siteId: string; scans: number }>;
  contentTypeBreakdown: Record<ContentType, number>;
  languagePreferences: Record<Language, number>;
  trends: {
    scanGrowth: number; // percentage
    viewGrowth: number; // percentage
    userGrowth: number; // percentage
  };
}

export interface DashboardData {
  lastUpdated: Date;
  realTimeMetrics: {
    activeUsers: number;
    activeSessions: number;
    scansInLastHour: number;
    viewsInLastHour: number;
  };
  todayStats: {
    totalScans: number;
    totalViews: number;
    totalInteractions: number;
    uniqueUsers: number;
  };
  weekStats: {
    totalScans: number;
    totalViews: number;
    uniqueUsers: number;
  };
  monthStats: {
    totalScans: number;
    totalViews: number;
    uniqueUsers: number;
  };
  popularContent: Array<{
    contentId: string;
    contentType: ContentType;
    views: number;
    averageDuration: number;
  }>;
  userEngagement: {
    averageSessionDuration: number;
    averageViewsPerSession: number;
    completionRate: number;
  };
  systemHealth: {
    status: 'healthy' | 'degraded' | 'down';
    uptime: number;
    errorRate: number;
  };
}

export interface TrendData {
  period: string; // e.g., "2026-02-11"
  scans: number;
  views: number;
  users: number;
}

export interface VisualizationData {
  chartType: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color?: string;
  }>;
}

export class ReportingService {
  private analyticsService: AnalyticsService;
  private reports: Map<string, UsageReport>;
  private dashboardCache: DashboardData | null;
  private cacheExpiry: number; // milliseconds
  private autoRefreshEnabled: boolean;

  constructor(analyticsService: AnalyticsService, cacheExpiry: number = 60000) {
    this.analyticsService = analyticsService;
    this.reports = new Map();
    this.dashboardCache = null;
    this.cacheExpiry = cacheExpiry;
    this.autoRefreshEnabled = false;

    logger.info('Reporting service initialized', {
      cacheExpiry,
    });
  }

  /**
   * Generate usage report
   */
  public async generateReport(
    type: ReportType,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageReport> {
    const reportId = this.generateReportId();
    const now = new Date();

    // Calculate date range based on report type
    const dateRange = this.calculateDateRange(type, startDate, endDate);

    logger.info('Generating usage report', {
      reportId,
      type,
      startDate: dateRange.start,
      endDate: dateRange.end,
    });

    // Get analytics data
    const summary = this.analyticsService.getAnalyticsSummary(
      dateRange.start,
      dateRange.end
    );

    const metrics = this.analyticsService.getMetrics();

    // Calculate trends (compare with previous period)
    const previousPeriod = this.calculatePreviousPeriod(dateRange.start, dateRange.end);
    const previousSummary = this.analyticsService.getAnalyticsSummary(
      previousPeriod.start,
      previousPeriod.end
    );

    const trends = {
      scanGrowth: this.calculateGrowth(summary.scans, previousSummary.scans),
      viewGrowth: this.calculateGrowth(summary.views, previousSummary.views),
      userGrowth: this.calculateGrowth(summary.uniqueSessions, previousSummary.uniqueSessions),
    };

    // Build top artifacts list
    const topArtifacts = metrics.popularArtifacts.slice(0, 10).map(artifact => ({
      artifactId: artifact.artifactId,
      scans: artifact.count,
      views: artifact.count, // Simplified
    }));

    // Build top sites list
    const topSites = metrics.popularSites.slice(0, 10).map(site => ({
      siteId: site.siteId,
      scans: site.count,
    }));

    const report: UsageReport = {
      reportId,
      reportType: type,
      generatedAt: now,
      startDate: dateRange.start,
      endDate: dateRange.end,
      summary: {
        totalScans: summary.scans,
        totalViews: summary.views,
        totalInteractions: summary.interactions,
        uniqueUsers: summary.uniqueSessions, // Using sessions as proxy
        uniqueSessions: summary.uniqueSessions,
        averageSessionDuration: metrics.averageSessionDuration,
      },
      topArtifacts,
      topSites,
      contentTypeBreakdown: metrics.contentTypeDistribution,
      languagePreferences: metrics.languageDistribution,
      trends,
    };

    // Store report
    this.reports.set(reportId, report);

    logger.info('Usage report generated', {
      reportId,
      totalScans: report.summary.totalScans,
      totalViews: report.summary.totalViews,
    });

    return report;
  }

  /**
   * Get dashboard data
   */
  public async getDashboardData(forceRefresh: boolean = false): Promise<DashboardData> {
    // Check cache
    if (!forceRefresh && this.dashboardCache && this.isCacheValid()) {
      logger.debug('Returning cached dashboard data');
      return this.dashboardCache;
    }

    logger.info('Generating dashboard data');

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get metrics for different time periods
    const hourSummary = this.analyticsService.getAnalyticsSummary(oneHourAgo, now);
    const todaySummary = this.analyticsService.getAnalyticsSummary(todayStart, now);
    const weekSummary = this.analyticsService.getAnalyticsSummary(weekStart, now);
    const monthSummary = this.analyticsService.getAnalyticsSummary(monthStart, now);

    const metrics = this.analyticsService.getMetrics();

    const dashboardData: DashboardData = {
      lastUpdated: now,
      realTimeMetrics: {
        activeUsers: hourSummary.uniqueSessions,
        activeSessions: hourSummary.uniqueSessions,
        scansInLastHour: hourSummary.scans,
        viewsInLastHour: hourSummary.views,
      },
      todayStats: {
        totalScans: todaySummary.scans,
        totalViews: todaySummary.views,
        totalInteractions: todaySummary.interactions,
        uniqueUsers: todaySummary.uniqueSessions,
      },
      weekStats: {
        totalScans: weekSummary.scans,
        totalViews: weekSummary.views,
        uniqueUsers: weekSummary.uniqueSessions,
      },
      monthStats: {
        totalScans: monthSummary.scans,
        totalViews: monthSummary.views,
        uniqueUsers: monthSummary.uniqueSessions,
      },
      popularContent: [],
      userEngagement: {
        averageSessionDuration: metrics.averageSessionDuration,
        averageViewsPerSession: metrics.totalContentViews / Math.max(metrics.uniqueSessions, 1),
        completionRate: 0.75, // Simplified
      },
      systemHealth: {
        status: 'healthy',
        uptime: 99.9,
        errorRate: 0.01,
      },
    };

    // Cache the dashboard data
    this.dashboardCache = dashboardData;

    logger.info('Dashboard data generated');

    return dashboardData;
  }

  /**
   * Generate trend data for visualization
   */
  public generateTrendData(days: number = 7): TrendData[] {
    const trends: TrendData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const summary = this.analyticsService.getAnalyticsSummary(dayStart, dayEnd);

      trends.push({
        period: dayStart.toISOString().split('T')[0],
        scans: summary.scans,
        views: summary.views,
        users: summary.uniqueSessions,
      });
    }

    logger.debug('Trend data generated', { days, dataPoints: trends.length });

    return trends;
  }

  /**
   * Generate visualization data
   */
  public generateVisualization(
    type: 'scans' | 'views' | 'users' | 'content-types' | 'languages',
    days: number = 7
  ): VisualizationData {
    logger.info('Generating visualization', { type, days });

    if (type === 'content-types') {
      const metrics = this.analyticsService.getMetrics();
      const contentTypes = Object.entries(metrics.contentTypeDistribution);

      return {
        chartType: 'pie',
        title: 'Content Type Distribution',
        labels: contentTypes.map(([type]) => type),
        datasets: [
          {
            label: 'Views',
            data: contentTypes.map(([, count]) => count),
          },
        ],
      };
    }

    if (type === 'languages') {
      const metrics = this.analyticsService.getMetrics();
      const languages = Object.entries(metrics.languageDistribution);

      return {
        chartType: 'bar',
        title: 'Language Preferences',
        labels: languages.map(([lang]) => lang),
        datasets: [
          {
            label: 'Views',
            data: languages.map(([, count]) => count),
          },
        ],
      };
    }

    // Time-series data
    const trends = this.generateTrendData(days);

    const dataMap = {
      scans: trends.map(t => t.scans),
      views: trends.map(t => t.views),
      users: trends.map(t => t.users),
    };

    const titleMap = {
      scans: 'QR Scans Over Time',
      views: 'Content Views Over Time',
      users: 'Unique Users Over Time',
    };

    return {
      chartType: 'line',
      title: titleMap[type as keyof typeof titleMap],
      labels: trends.map(t => t.period),
      datasets: [
        {
          label: type.charAt(0).toUpperCase() + type.slice(1),
          data: dataMap[type as keyof typeof dataMap],
          color: '#4CAF50',
        },
      ],
    };
  }

  /**
   * Export report in specified format
   */
  public async exportReport(reportId: string, format: ReportFormat): Promise<string> {
    const report = this.reports.get(reportId);

    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    logger.info('Exporting report', { reportId, format });

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);

      case 'csv':
        return this.convertToCSV(report);

      case 'pdf':
        // Simplified - in production would generate actual PDF
        return `PDF Report: ${report.reportId}`;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Get report by ID
   */
  public getReport(reportId: string): UsageReport | null {
    return this.reports.get(reportId) || null;
  }

  /**
   * Get all reports
   */
  public getAllReports(): UsageReport[] {
    return Array.from(this.reports.values());
  }

  /**
   * Enable auto-refresh for dashboard
   */
  public enableAutoRefresh(): void {
    this.autoRefreshEnabled = true;
    logger.info('Auto-refresh enabled');
  }

  /**
   * Disable auto-refresh for dashboard
   */
  public disableAutoRefresh(): void {
    this.autoRefreshEnabled = false;
    logger.info('Auto-refresh disabled');
  }

  /**
   * Check if auto-refresh is enabled
   */
  public isAutoRefreshEnabled(): boolean {
    return this.autoRefreshEnabled;
  }

  /**
   * Clear dashboard cache
   */
  public clearCache(): void {
    this.dashboardCache = null;
    logger.info('Dashboard cache cleared');
  }

  /**
   * Calculate date range based on report type
   */
  private calculateDateRange(
    type: ReportType,
    startDate?: Date,
    endDate?: Date
  ): { start: Date; end: Date } {
    const now = new Date();

    if (type === 'custom' && startDate && endDate) {
      return { start: startDate, end: endDate };
    }

    switch (type) {
      case 'daily':
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { start: dayStart, end: now };

      case 'weekly':
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: weekStart, end: now };

      case 'monthly':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: monthStart, end: now };

      default:
        return { start: now, end: now };
    }
  }

  /**
   * Calculate previous period for trend comparison
   */
  private calculatePreviousPeriod(start: Date, end: Date): { start: Date; end: Date } {
    const duration = end.getTime() - start.getTime();
    return {
      start: new Date(start.getTime() - duration),
      end: start,
    };
  }

  /**
   * Calculate growth percentage
   */
  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.dashboardCache) return false;
    const now = new Date();
    const cacheAge = now.getTime() - this.dashboardCache.lastUpdated.getTime();
    return cacheAge < this.cacheExpiry;
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert report to CSV format
   */
  private convertToCSV(report: UsageReport): string {
    const lines: string[] = [];

    // Header
    lines.push('Usage Report');
    lines.push(`Report ID,${report.reportId}`);
    lines.push(`Type,${report.reportType}`);
    lines.push(`Generated,${report.generatedAt.toISOString()}`);
    lines.push(`Period,${report.startDate.toISOString()} to ${report.endDate.toISOString()}`);
    lines.push('');

    // Summary
    lines.push('Summary');
    lines.push('Metric,Value');
    lines.push(`Total Scans,${report.summary.totalScans}`);
    lines.push(`Total Views,${report.summary.totalViews}`);
    lines.push(`Total Interactions,${report.summary.totalInteractions}`);
    lines.push(`Unique Users,${report.summary.uniqueUsers}`);
    lines.push(`Unique Sessions,${report.summary.uniqueSessions}`);
    lines.push(`Average Session Duration,${report.summary.averageSessionDuration}`);
    lines.push('');

    // Trends
    lines.push('Trends');
    lines.push('Metric,Growth %');
    lines.push(`Scan Growth,${report.trends.scanGrowth.toFixed(2)}`);
    lines.push(`View Growth,${report.trends.viewGrowth.toFixed(2)}`);
    lines.push(`User Growth,${report.trends.userGrowth.toFixed(2)}`);

    return lines.join('\n');
  }

  /**
   * Get service status
   */
  public getStatus(): {
    totalReports: number;
    cacheValid: boolean;
    autoRefreshEnabled: boolean;
    cacheExpiry: number;
  } {
    return {
      totalReports: this.reports.size,
      cacheValid: this.isCacheValid(),
      autoRefreshEnabled: this.autoRefreshEnabled,
      cacheExpiry: this.cacheExpiry,
    };
  }
}
