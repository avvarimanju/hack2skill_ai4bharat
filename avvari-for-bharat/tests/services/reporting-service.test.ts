// Unit tests for ReportingService
import { ReportingService } from '../../src/services/reporting-service';
import { AnalyticsService } from '../../src/services/analytics-service';
import { Language, ContentType, InteractionType } from '../../src/models/common';

jest.mock('../../src/utils/logger');

describe('ReportingService', () => {
  let reportingService: ReportingService;
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService(true);
    reportingService = new ReportingService(analyticsService, 60000);

    // Add some test data
    analyticsService.trackQRScan({
      artifactId: 'artifact-1',
      siteId: 'site-1',
      sessionId: 'session-1',
      userId: 'user-1',
    });

    analyticsService.trackContentView({
      contentId: 'content-1',
      contentType: ContentType.AUDIO_GUIDE,
      artifactId: 'artifact-1',
      siteId: 'site-1',
      sessionId: 'session-1',
      userId: 'user-1',
      duration: 120,
      language: Language.ENGLISH,
      completed: true,
    });

    analyticsService.trackInteraction({
      type: InteractionType.PLAY,
      contentId: 'content-1',
      artifactId: 'artifact-1',
      siteId: 'site-1',
      sessionId: 'session-1',
      userId: 'user-1',
    });
  });

  describe('initialization', () => {
    it('should initialize with correct settings', () => {
      const status = reportingService.getStatus();

      expect(status.totalReports).toBe(0);
      expect(status.autoRefreshEnabled).toBe(false);
      expect(status.cacheExpiry).toBe(60000);
    });
  });

  describe('generateReport', () => {
    it('should generate daily report', async () => {
      const report = await reportingService.generateReport('daily');

      expect(report).toBeDefined();
      expect(report.reportId).toContain('report-');
      expect(report.reportType).toBe('daily');
      expect(report.summary).toBeDefined();
      expect(report.summary.totalScans).toBeGreaterThanOrEqual(0);
    });

    it('should generate weekly report', async () => {
      const report = await reportingService.generateReport('weekly');

      expect(report.reportType).toBe('weekly');
      expect(report.startDate).toBeDefined();
      expect(report.endDate).toBeDefined();
    });

    it('should generate monthly report', async () => {
      const report = await reportingService.generateReport('monthly');

      expect(report.reportType).toBe('monthly');
    });

    it('should generate custom report with date range', async () => {
      const startDate = new Date('2026-02-01');
      const endDate = new Date('2026-02-11');

      const report = await reportingService.generateReport('custom', startDate, endDate);

      expect(report.reportType).toBe('custom');
      expect(report.startDate).toEqual(startDate);
      expect(report.endDate).toEqual(endDate);
    });

    it('should include summary data', async () => {
      const report = await reportingService.generateReport('daily');

      expect(report.summary).toHaveProperty('totalScans');
      expect(report.summary).toHaveProperty('totalViews');
      expect(report.summary).toHaveProperty('totalInteractions');
      expect(report.summary).toHaveProperty('uniqueUsers');
      expect(report.summary).toHaveProperty('uniqueSessions');
      expect(report.summary).toHaveProperty('averageSessionDuration');
    });

    it('should include trend data', async () => {
      const report = await reportingService.generateReport('daily');

      expect(report.trends).toHaveProperty('scanGrowth');
      expect(report.trends).toHaveProperty('viewGrowth');
      expect(report.trends).toHaveProperty('userGrowth');
    });

    it('should include top artifacts and sites', async () => {
      const report = await reportingService.generateReport('daily');

      expect(report.topArtifacts).toBeDefined();
      expect(report.topSites).toBeDefined();
      expect(Array.isArray(report.topArtifacts)).toBe(true);
      expect(Array.isArray(report.topSites)).toBe(true);
    });

    it('should store generated report', async () => {
      const report = await reportingService.generateReport('daily');

      const retrieved = reportingService.getReport(report.reportId);
      expect(retrieved).toEqual(report);
    });
  });

  describe('getDashboardData', () => {
    it('should generate dashboard data', async () => {
      const dashboard = await reportingService.getDashboardData();

      expect(dashboard).toBeDefined();
      expect(dashboard.lastUpdated).toBeInstanceOf(Date);
      expect(dashboard.realTimeMetrics).toBeDefined();
      expect(dashboard.todayStats).toBeDefined();
      expect(dashboard.weekStats).toBeDefined();
      expect(dashboard.monthStats).toBeDefined();
    });

    it('should include real-time metrics', async () => {
      const dashboard = await reportingService.getDashboardData();

      expect(dashboard.realTimeMetrics).toHaveProperty('activeUsers');
      expect(dashboard.realTimeMetrics).toHaveProperty('activeSessions');
      expect(dashboard.realTimeMetrics).toHaveProperty('scansInLastHour');
      expect(dashboard.realTimeMetrics).toHaveProperty('viewsInLastHour');
    });

    it('should include user engagement metrics', async () => {
      const dashboard = await reportingService.getDashboardData();

      expect(dashboard.userEngagement).toHaveProperty('averageSessionDuration');
      expect(dashboard.userEngagement).toHaveProperty('averageViewsPerSession');
      expect(dashboard.userEngagement).toHaveProperty('completionRate');
    });

    it('should include system health', async () => {
      const dashboard = await reportingService.getDashboardData();

      expect(dashboard.systemHealth).toHaveProperty('status');
      expect(dashboard.systemHealth).toHaveProperty('uptime');
      expect(dashboard.systemHealth).toHaveProperty('errorRate');
      expect(dashboard.systemHealth.status).toBe('healthy');
    });

    it('should cache dashboard data', async () => {
      const dashboard1 = await reportingService.getDashboardData();
      const dashboard2 = await reportingService.getDashboardData();

      expect(dashboard1.lastUpdated).toEqual(dashboard2.lastUpdated);
    });

    it('should force refresh when requested', async () => {
      const dashboard1 = await reportingService.getDashboardData();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const dashboard2 = await reportingService.getDashboardData(true);

      expect(dashboard2.lastUpdated.getTime()).toBeGreaterThanOrEqual(dashboard1.lastUpdated.getTime());
    });
  });

  describe('generateTrendData', () => {
    it('should generate trend data for specified days', () => {
      const trends = reportingService.generateTrendData(7);

      expect(trends).toHaveLength(7);
      expect(trends[0]).toHaveProperty('period');
      expect(trends[0]).toHaveProperty('scans');
      expect(trends[0]).toHaveProperty('views');
      expect(trends[0]).toHaveProperty('users');
    });

    it('should generate trend data for custom period', () => {
      const trends = reportingService.generateTrendData(14);

      expect(trends).toHaveLength(14);
    });

    it('should have chronological order', () => {
      const trends = reportingService.generateTrendData(5);

      for (let i = 1; i < trends.length; i++) {
        const prev = new Date(trends[i - 1].period);
        const curr = new Date(trends[i].period);
        expect(curr.getTime()).toBeGreaterThan(prev.getTime());
      }
    });
  });

  describe('generateVisualization', () => {
    it('should generate scans visualization', () => {
      const viz = reportingService.generateVisualization('scans', 7);

      expect(viz.chartType).toBe('line');
      expect(viz.title).toContain('Scans');
      expect(viz.labels).toHaveLength(7);
      expect(viz.datasets).toHaveLength(1);
    });

    it('should generate views visualization', () => {
      const viz = reportingService.generateVisualization('views', 7);

      expect(viz.chartType).toBe('line');
      expect(viz.title).toContain('Views');
    });

    it('should generate users visualization', () => {
      const viz = reportingService.generateVisualization('users', 7);

      expect(viz.chartType).toBe('line');
      expect(viz.title).toContain('Users');
    });

    it('should generate content types visualization', () => {
      const viz = reportingService.generateVisualization('content-types');

      expect(viz.chartType).toBe('pie');
      expect(viz.title).toContain('Content Type');
    });

    it('should generate languages visualization', () => {
      const viz = reportingService.generateVisualization('languages');

      expect(viz.chartType).toBe('bar');
      expect(viz.title).toContain('Language');
    });
  });

  describe('exportReport', () => {
    it('should export report as JSON', async () => {
      const report = await reportingService.generateReport('daily');
      const exported = await reportingService.exportReport(report.reportId, 'json');

      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      
      const parsed = JSON.parse(exported);
      expect(parsed.reportId).toBe(report.reportId);
    });

    it('should export report as CSV', async () => {
      const report = await reportingService.generateReport('daily');
      const exported = await reportingService.exportReport(report.reportId, 'csv');

      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      expect(exported).toContain('Usage Report');
      expect(exported).toContain(report.reportId);
    });

    it('should export report as PDF', async () => {
      const report = await reportingService.generateReport('daily');
      const exported = await reportingService.exportReport(report.reportId, 'pdf');

      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      expect(exported).toContain('PDF Report');
    });

    it('should throw error for non-existent report', async () => {
      await expect(
        reportingService.exportReport('non-existent', 'json')
      ).rejects.toThrow('Report non-existent not found');
    });
  });

  describe('report management', () => {
    it('should get report by ID', async () => {
      const report = await reportingService.generateReport('daily');
      const retrieved = reportingService.getReport(report.reportId);

      expect(retrieved).toEqual(report);
    });

    it('should return null for non-existent report', () => {
      const retrieved = reportingService.getReport('non-existent');

      expect(retrieved).toBeNull();
    });

    it('should get all reports', async () => {
      await reportingService.generateReport('daily');
      await reportingService.generateReport('weekly');

      const reports = reportingService.getAllReports();

      expect(reports).toHaveLength(2);
    });
  });

  describe('auto-refresh', () => {
    it('should enable auto-refresh', () => {
      reportingService.enableAutoRefresh();

      expect(reportingService.isAutoRefreshEnabled()).toBe(true);
    });

    it('should disable auto-refresh', () => {
      reportingService.enableAutoRefresh();
      reportingService.disableAutoRefresh();

      expect(reportingService.isAutoRefreshEnabled()).toBe(false);
    });

    it('should be disabled by default', () => {
      expect(reportingService.isAutoRefreshEnabled()).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should clear dashboard cache', async () => {
      await reportingService.getDashboardData();
      
      const statusBefore = reportingService.getStatus();
      expect(statusBefore.cacheValid).toBe(true);

      reportingService.clearCache();

      const statusAfter = reportingService.getStatus();
      expect(statusAfter.cacheValid).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return service status', async () => {
      await reportingService.generateReport('daily');
      await reportingService.getDashboardData();

      const status = reportingService.getStatus();

      expect(status).toHaveProperty('totalReports');
      expect(status).toHaveProperty('cacheValid');
      expect(status).toHaveProperty('autoRefreshEnabled');
      expect(status).toHaveProperty('cacheExpiry');
      expect(status.totalReports).toBe(1);
    });
  });
});
