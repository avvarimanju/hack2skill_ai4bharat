// Performance Monitoring Service for CloudWatch metrics and tracing
import {
  CloudWatchClient,
  PutMetricDataCommand,
  MetricDatum,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import { logger } from '../utils/logger';

export interface PerformanceMetric {
  metricName: string;
  value: number;
  unit: StandardUnit;
  dimensions?: Record<string, string>;
  timestamp?: Date;
}

export interface RequestTrace {
  requestId: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceAlert {
  alertName: string;
  threshold: number;
  currentValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
}

export interface PerformanceDashboardData {
  averageResponseTime: number;
  errorRate: number;
  requestCount: number;
  cacheHitRate: number;
  activeUsers: number;
  topSlowOperations: Array<{
    operation: string;
    averageDuration: number;
    count: number;
  }>;
  recentErrors: Array<{
    operation: string;
    error: string;
    timestamp: Date;
  }>;
}

export class PerformanceMonitoringService {
  private readonly cloudWatchClient: CloudWatchClient;
  private readonly namespace: string;
  private readonly traces: Map<string, RequestTrace>;
  private readonly metricsBuffer: MetricDatum[];
  private readonly bufferFlushInterval: number;
  private flushTimer?: NodeJS.Timeout;
  private readonly autoFlush: boolean;

  constructor(region: string = 'ap-south-1', namespace: string = 'AvvarI/Platform', autoFlush: boolean = true) {
    this.cloudWatchClient = new CloudWatchClient({ region });
    this.namespace = namespace;
    this.traces = new Map();
    this.metricsBuffer = [];
    this.bufferFlushInterval = 60000; // 1 minute
    this.autoFlush = autoFlush;

    // Start periodic flush only if autoFlush is enabled
    if (this.autoFlush) {
      this.startPeriodicFlush();
    }

    logger.info('Performance monitoring service initialized', {
      namespace,
      region,
    });
  }

  /**
   * Start request trace
   */
  public startTrace(requestId: string, operation: string, metadata?: Record<string, any>): void {
    const trace: RequestTrace = {
      requestId,
      operation,
      startTime: Date.now(),
      metadata,
    };

    this.traces.set(requestId, trace);

    logger.debug('Request trace started', {
      requestId,
      operation,
    });
  }

  /**
   * End request trace and record metrics
   */
  public async endTrace(
    requestId: string,
    statusCode: number,
    error?: string
  ): Promise<void> {
    const trace = this.traces.get(requestId);

    if (!trace) {
      logger.warn('Trace not found', { requestId });
      return;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.statusCode = statusCode;
    trace.error = error;

    // Record metrics
    await this.recordResponseTime(trace.operation, trace.duration);

    if (error || statusCode >= 400) {
      await this.recordError(trace.operation, statusCode, error);
    }

    // Clean up trace
    this.traces.delete(requestId);

    logger.debug('Request trace ended', {
      requestId,
      operation: trace.operation,
      duration: trace.duration,
      statusCode,
    });
  }

  /**
   * Record response time metric
   */
  public async recordResponseTime(operation: string, duration: number): Promise<void> {
    await this.recordMetric({
      metricName: 'ResponseTime',
      value: duration,
      unit: StandardUnit.Milliseconds,
      dimensions: {
        Operation: operation,
      },
    });
  }

  /**
   * Record error metric
   */
  public async recordError(
    operation: string,
    statusCode: number,
    error?: string
  ): Promise<void> {
    await this.recordMetric({
      metricName: 'ErrorCount',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        Operation: operation,
        StatusCode: statusCode.toString(),
      },
    });

    if (error) {
      logger.error('Operation error recorded', {
        operation,
        statusCode,
        error,
      });
    }
  }

  /**
   * Record request count metric
   */
  public async recordRequest(operation: string): Promise<void> {
    await this.recordMetric({
      metricName: 'RequestCount',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        Operation: operation,
      },
    });
  }

  /**
   * Record cache hit/miss metric
   */
  public async recordCacheHit(hit: boolean, cacheType: string): Promise<void> {
    await this.recordMetric({
      metricName: hit ? 'CacheHit' : 'CacheMiss',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        CacheType: cacheType,
      },
    });
  }

  /**
   * Record active users metric
   */
  public async recordActiveUsers(count: number): Promise<void> {
    await this.recordMetric({
      metricName: 'ActiveUsers',
      value: count,
      unit: StandardUnit.Count,
    });
  }

  /**
   * Record content generation time
   */
  public async recordContentGeneration(
    contentType: string,
    duration: number,
    success: boolean
  ): Promise<void> {
    await this.recordMetric({
      metricName: 'ContentGenerationTime',
      value: duration,
      unit: StandardUnit.Milliseconds,
      dimensions: {
        ContentType: contentType,
        Status: success ? 'Success' : 'Failure',
      },
    });
  }

  /**
   * Record custom metric
   */
  public async recordMetric(metric: PerformanceMetric): Promise<void> {
    const metricDatum: MetricDatum = {
      MetricName: metric.metricName,
      Value: metric.value,
      Unit: metric.unit,
      Timestamp: metric.timestamp || new Date(),
      Dimensions: metric.dimensions
        ? Object.entries(metric.dimensions).map(([Name, Value]) => ({
            Name,
            Value,
          }))
        : undefined,
    };

    this.metricsBuffer.push(metricDatum);

    // Flush if buffer is large
    if (this.metricsBuffer.length >= 20) {
      await this.flushMetrics();
    }
  }

  /**
   * Flush metrics buffer to CloudWatch
   */
  public async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    try {
      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: this.metricsBuffer.splice(0, 20), // CloudWatch limit: 20 metrics per request
      });

      await this.cloudWatchClient.send(command);

      logger.debug('Metrics flushed to CloudWatch', {
        count: this.metricsBuffer.length,
      });
    } catch (error) {
      logger.error('Failed to flush metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get active traces
   */
  public getActiveTraces(): RequestTrace[] {
    return Array.from(this.traces.values());
  }

  /**
   * Get trace by request ID
   */
  public getTrace(requestId: string): RequestTrace | undefined {
    return this.traces.get(requestId);
  }

  /**
   * Check performance thresholds and generate alerts
   */
  public async checkPerformanceThresholds(
    dashboardData: PerformanceDashboardData
  ): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];

    // Check response time threshold (500ms)
    if (dashboardData.averageResponseTime > 500) {
      alerts.push({
        alertName: 'HighResponseTime',
        threshold: 500,
        currentValue: dashboardData.averageResponseTime,
        severity: dashboardData.averageResponseTime > 1000 ? 'critical' : 'high',
        message: `Average response time (${dashboardData.averageResponseTime}ms) exceeds threshold`,
        timestamp: new Date(),
      });
    }

    // Check error rate threshold (5%)
    if (dashboardData.errorRate > 0.05) {
      alerts.push({
        alertName: 'HighErrorRate',
        threshold: 0.05,
        currentValue: dashboardData.errorRate,
        severity: dashboardData.errorRate > 0.1 ? 'critical' : 'high',
        message: `Error rate (${(dashboardData.errorRate * 100).toFixed(2)}%) exceeds threshold`,
        timestamp: new Date(),
      });
    }

    // Check cache hit rate threshold (70%)
    if (dashboardData.cacheHitRate < 0.7) {
      alerts.push({
        alertName: 'LowCacheHitRate',
        threshold: 0.7,
        currentValue: dashboardData.cacheHitRate,
        severity: dashboardData.cacheHitRate < 0.5 ? 'high' : 'medium',
        message: `Cache hit rate (${(dashboardData.cacheHitRate * 100).toFixed(2)}%) below threshold`,
        timestamp: new Date(),
      });
    }

    // Log alerts
    for (const alert of alerts) {
      logger.warn('Performance alert generated', {
        alertName: alert.alertName,
        severity: alert.severity,
        message: alert.message,
      });
    }

    return alerts;
  }

  /**
   * Generate performance dashboard data
   */
  public async generateDashboardData(): Promise<PerformanceDashboardData> {
    // In production, this would query CloudWatch metrics
    // For now, return mock data structure

    const activeTraces = this.getActiveTraces();
    const completedTraces = activeTraces.filter(t => t.endTime);

    const averageResponseTime =
      completedTraces.length > 0
        ? completedTraces.reduce((sum, t) => sum + (t.duration || 0), 0) /
          completedTraces.length
        : 0;

    const errorCount = completedTraces.filter(
      t => t.error || (t.statusCode && t.statusCode >= 400)
    ).length;
    const errorRate = completedTraces.length > 0 ? errorCount / completedTraces.length : 0;

    return {
      averageResponseTime,
      errorRate,
      requestCount: completedTraces.length,
      cacheHitRate: 0.75, // Mock value
      activeUsers: 0, // Mock value
      topSlowOperations: [],
      recentErrors: [],
    };
  }

  /**
   * Start periodic metrics flush
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics().catch(error => {
        logger.error('Periodic metrics flush failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.bufferFlushInterval);
  }

  /**
   * Stop periodic metrics flush
   */
  public stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Cleanup and flush remaining metrics
   */
  public async cleanup(): Promise<void> {
    this.stopPeriodicFlush();
    await this.flushMetrics();
    logger.info('Performance monitoring service cleaned up');
  }
}
