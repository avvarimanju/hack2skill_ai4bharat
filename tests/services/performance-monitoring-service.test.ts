// Unit tests for PerformanceMonitoringService
import { PerformanceMonitoringService } from '../../src/services/performance-monitoring-service';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { StandardUnit } from '@aws-sdk/client-cloudwatch';

// Mock dependencies
jest.mock('@aws-sdk/client-cloudwatch');
jest.mock('../../src/utils/logger');

describe('PerformanceMonitoringService', () => {
  let service: PerformanceMonitoringService;
  let mockCloudWatchSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CloudWatch client
    mockCloudWatchSend = jest.fn().mockResolvedValue({});
    (CloudWatchClient as jest.Mock).mockImplementation(() => ({
      send: mockCloudWatchSend,
    }));

    service = new PerformanceMonitoringService('us-east-1', 'TestNamespace', false);
    
    // Clear any pending metrics
    mockCloudWatchSend.mockClear();
  });

  afterEach(async () => {
    if (service) {
      await service.cleanup();
    }
  });

  describe('startTrace and endTrace', () => {
    it('should start and end a trace successfully', async () => {
      const requestId = 'test-request-123';
      const operation = 'testOperation';

      service.startTrace(requestId, operation);

      const trace = service.getTrace(requestId);
      expect(trace).toBeDefined();
      expect(trace?.requestId).toBe(requestId);
      expect(trace?.operation).toBe(operation);
      expect(trace?.startTime).toBeDefined();

      await service.endTrace(requestId, 200);

      const endedTrace = service.getTrace(requestId);
      expect(endedTrace).toBeUndefined(); // Should be cleaned up
    });

    it('should record response time on trace end', async () => {
      const requestId = 'test-request-456';
      const operation = 'slowOperation';

      service.startTrace(requestId, operation);
      await service.endTrace(requestId, 200);

      // Metrics should be buffered
      expect(mockCloudWatchSend).not.toHaveBeenCalled(); // Not flushed yet
    });

    it('should record error on failed trace', async () => {
      const requestId = 'test-request-789';
      const operation = 'failedOperation';

      service.startTrace(requestId, operation);
      await service.endTrace(requestId, 500, 'Internal Server Error');

      // Error metric should be recorded
      const activeTraces = service.getActiveTraces();
      expect(activeTraces.find(t => t.requestId === requestId)).toBeUndefined();
    });

    it('should handle ending non-existent trace gracefully', async () => {
      await expect(service.endTrace('non-existent', 200)).resolves.not.toThrow();
    });
  });

  describe('recordResponseTime', () => {
    it('should record response time metric', async () => {
      await service.recordResponseTime('testOp', 150);

      // Should be in buffer
      await service.flushMetrics();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });
  });

  describe('recordError', () => {
    it('should record error metric', async () => {
      await service.recordError('testOp', 500, 'Test error');

      await service.flushMetrics();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });

    it('should record error without error message', async () => {
      await service.recordError('testOp', 404);

      await service.flushMetrics();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });
  });

  describe('recordRequest', () => {
    it('should record request count', async () => {
      await service.recordRequest('testOperation');

      await service.flushMetrics();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });
  });

  describe('recordCacheHit', () => {
    it('should record cache hit', async () => {
      await service.recordCacheHit(true, 'content');

      await service.flushMetrics();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });

    it('should record cache miss', async () => {
      await service.recordCacheHit(false, 'content');

      await service.flushMetrics();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });
  });

  describe('recordActiveUsers', () => {
    it('should record active users count', async () => {
      await service.recordActiveUsers(42);

      await service.flushMetrics();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });
  });

  describe('recordContentGeneration', () => {
    it('should record successful content generation', async () => {
      await service.recordContentGeneration('video', 1500, true);

      await service.flushMetrics();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });

    it('should record failed content generation', async () => {
      await service.recordContentGeneration('audio', 500, false);

      await service.flushMetrics();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });
  });

  describe('recordMetric', () => {
    it('should record custom metric', async () => {
      await service.recordMetric({
        metricName: 'CustomMetric',
        value: 100,
        unit: StandardUnit.Count,
        dimensions: {
          Environment: 'test',
        },
      });

      await service.flushMetrics();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });

    it('should auto-flush when buffer reaches limit', async () => {
      // Add 20 metrics to trigger auto-flush
      for (let i = 0; i < 20; i++) {
        await service.recordMetric({
          metricName: 'TestMetric',
          value: i,
          unit: StandardUnit.Count,
        });
      }

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });
  });

  describe('flushMetrics', () => {
    it('should flush metrics to CloudWatch', async () => {
      await service.recordMetric({
        metricName: 'TestMetric',
        value: 1,
        unit: StandardUnit.Count,
      });

      await service.flushMetrics();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });

    it('should handle empty buffer', async () => {
      await service.flushMetrics();

      expect(mockCloudWatchSend).not.toHaveBeenCalled();
    });

    it('should handle flush errors gracefully', async () => {
      mockCloudWatchSend.mockRejectedValue(new Error('CloudWatch error'));

      await service.recordMetric({
        metricName: 'TestMetric',
        value: 1,
        unit: StandardUnit.Count,
      });

      await expect(service.flushMetrics()).resolves.not.toThrow();
    });
  });

  describe('getActiveTraces', () => {
    it('should return all active traces', () => {
      service.startTrace('req-1', 'op1');
      service.startTrace('req-2', 'op2');
      service.startTrace('req-3', 'op3');

      const traces = service.getActiveTraces();

      expect(traces).toHaveLength(3);
      expect(traces.map(t => t.requestId)).toContain('req-1');
      expect(traces.map(t => t.requestId)).toContain('req-2');
      expect(traces.map(t => t.requestId)).toContain('req-3');
    });

    it('should return empty array when no traces', () => {
      const traces = service.getActiveTraces();

      expect(traces).toHaveLength(0);
    });
  });

  describe('getTrace', () => {
    it('should return specific trace by request ID', () => {
      service.startTrace('req-123', 'testOp');

      const trace = service.getTrace('req-123');

      expect(trace).toBeDefined();
      expect(trace?.requestId).toBe('req-123');
      expect(trace?.operation).toBe('testOp');
    });

    it('should return undefined for non-existent trace', () => {
      const trace = service.getTrace('non-existent');

      expect(trace).toBeUndefined();
    });
  });

  describe('checkPerformanceThresholds', () => {
    it('should generate alert for high response time', async () => {
      const dashboardData = {
        averageResponseTime: 1200,
        errorRate: 0.02,
        requestCount: 100,
        cacheHitRate: 0.8,
        activeUsers: 50,
        topSlowOperations: [],
        recentErrors: [],
      };

      const alerts = await service.checkPerformanceThresholds(dashboardData);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertName).toBe('HighResponseTime');
      expect(alerts[0].severity).toBe('critical');
    });

    it('should generate alert for high error rate', async () => {
      const dashboardData = {
        averageResponseTime: 200,
        errorRate: 0.15,
        requestCount: 100,
        cacheHitRate: 0.8,
        activeUsers: 50,
        topSlowOperations: [],
        recentErrors: [],
      };

      const alerts = await service.checkPerformanceThresholds(dashboardData);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertName).toBe('HighErrorRate');
      expect(alerts[0].severity).toBe('critical');
    });

    it('should generate alert for low cache hit rate', async () => {
      const dashboardData = {
        averageResponseTime: 200,
        errorRate: 0.02,
        requestCount: 100,
        cacheHitRate: 0.4,
        activeUsers: 50,
        topSlowOperations: [],
        recentErrors: [],
      };

      const alerts = await service.checkPerformanceThresholds(dashboardData);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertName).toBe('LowCacheHitRate');
      expect(alerts[0].severity).toBe('high');
    });

    it('should generate multiple alerts', async () => {
      const dashboardData = {
        averageResponseTime: 1200,
        errorRate: 0.15,
        requestCount: 100,
        cacheHitRate: 0.4,
        activeUsers: 50,
        topSlowOperations: [],
        recentErrors: [],
      };

      const alerts = await service.checkPerformanceThresholds(dashboardData);

      expect(alerts).toHaveLength(3);
      expect(alerts.map(a => a.alertName)).toContain('HighResponseTime');
      expect(alerts.map(a => a.alertName)).toContain('HighErrorRate');
      expect(alerts.map(a => a.alertName)).toContain('LowCacheHitRate');
    });

    it('should not generate alerts when all metrics are healthy', async () => {
      const dashboardData = {
        averageResponseTime: 200,
        errorRate: 0.02,
        requestCount: 100,
        cacheHitRate: 0.8,
        activeUsers: 50,
        topSlowOperations: [],
        recentErrors: [],
      };

      const alerts = await service.checkPerformanceThresholds(dashboardData);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('generateDashboardData', () => {
    it('should generate dashboard data', async () => {
      const data = await service.generateDashboardData();

      expect(data).toHaveProperty('averageResponseTime');
      expect(data).toHaveProperty('errorRate');
      expect(data).toHaveProperty('requestCount');
      expect(data).toHaveProperty('cacheHitRate');
      expect(data).toHaveProperty('activeUsers');
      expect(data).toHaveProperty('topSlowOperations');
      expect(data).toHaveProperty('recentErrors');
    });
  });

  describe('cleanup', () => {
    it('should cleanup and flush remaining metrics', async () => {
      await service.recordMetric({
        metricName: 'TestMetric',
        value: 1,
        unit: StandardUnit.Count,
      });

      await service.cleanup();

      expect(mockCloudWatchSend).toHaveBeenCalled();
    });
  });
});
