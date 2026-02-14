import { logger } from '../utils/logger';

/**
 * Concurrency Management Service
 * Handles concurrent user requests, load balancing, and graceful degradation
 */

export interface ConcurrencyConfig {
  maxConcurrentRequests: number;
  requestTimeout: number; // milliseconds
  queueSize: number;
  enableGracefulDegradation: boolean;
  degradationThreshold: number; // percentage (0-100)
}

export interface RequestMetrics {
  activeRequests: number;
  queuedRequests: number;
  completedRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  currentLoad: number; // percentage (0-100)
}

export interface RequestContext {
  requestId: string;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
  timeout: number;
}

export enum ServiceMode {
  NORMAL = 'normal',
  DEGRADED = 'degraded',
  OVERLOADED = 'overloaded',
}

export class ConcurrencyManagementService {
  private config: ConcurrencyConfig;
  private activeRequests: Map<string, RequestContext>;
  private requestQueue: RequestContext[];
  private metrics: RequestMetrics;
  private serviceMode: ServiceMode;
  private responseTimes: number[];
  private maxResponseTimeHistory: number = 100;

  constructor(config: Partial<ConcurrencyConfig> = {}) {
    this.config = {
      maxConcurrentRequests: config.maxConcurrentRequests || 1000,
      requestTimeout: config.requestTimeout || 30000,
      queueSize: config.queueSize || 500,
      enableGracefulDegradation: config.enableGracefulDegradation ?? true,
      degradationThreshold: config.degradationThreshold || 80,
    };

    this.activeRequests = new Map();
    this.requestQueue = [];
    this.responseTimes = [];
    this.serviceMode = ServiceMode.NORMAL;

    this.metrics = {
      activeRequests: 0,
      queuedRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      currentLoad: 0,
    };

    logger.info('Concurrency management service initialized', {
      maxConcurrentRequests: this.config.maxConcurrentRequests,
      queueSize: this.config.queueSize,
    });
  }

  /**
   * Acquire a request slot
   */
  public async acquireRequestSlot(
    requestId: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<boolean> {
    const context: RequestContext = {
      requestId,
      timestamp: Date.now(),
      priority,
      timeout: this.config.requestTimeout,
    };

    // Check if we can process immediately
    if (this.activeRequests.size < this.config.maxConcurrentRequests) {
      this.activeRequests.set(requestId, context);
      this.updateMetrics();
      logger.debug('Request slot acquired', { requestId, activeRequests: this.activeRequests.size });
      return true;
    }

    // Check if we can queue
    if (this.requestQueue.length < this.config.queueSize) {
      this.requestQueue.push(context);
      this.sortQueueByPriority();
      this.updateMetrics();
      logger.debug('Request queued', { requestId, queueSize: this.requestQueue.length });
      return true;
    }

    // System is overloaded
    this.metrics.failedRequests++;
    this.updateServiceMode();
    logger.warn('Request rejected - system overloaded', {
      requestId,
      activeRequests: this.activeRequests.size,
      queueSize: this.requestQueue.length,
    });
    return false;
  }

  /**
   * Release a request slot
   */
  public releaseRequestSlot(requestId: string, responseTime?: number): void {
    if (!this.activeRequests.has(requestId)) {
      logger.warn('Attempted to release non-existent request', { requestId });
      return;
    }

    this.activeRequests.delete(requestId);
    this.metrics.completedRequests++;

    // Track response time
    if (responseTime !== undefined) {
      this.responseTimes.push(responseTime);
      if (this.responseTimes.length > this.maxResponseTimeHistory) {
        this.responseTimes.shift();
      }
      this.metrics.averageResponseTime = this.calculateAverageResponseTime();
    }

    // Process next queued request
    this.processNextQueuedRequest();

    this.updateMetrics();
    logger.debug('Request slot released', { requestId, activeRequests: this.activeRequests.size });
  }

  /**
   * Mark request as failed
   */
  public markRequestFailed(requestId: string): void {
    if (this.activeRequests.has(requestId)) {
      this.activeRequests.delete(requestId);
    }

    this.metrics.failedRequests++;
    this.processNextQueuedRequest();
    this.updateMetrics();

    logger.debug('Request marked as failed', { requestId });
  }

  /**
   * Get current metrics
   */
  public getMetrics(): RequestMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current service mode
   */
  public getServiceMode(): ServiceMode {
    return this.serviceMode;
  }

  /**
   * Check if system can accept new requests
   */
  public canAcceptRequest(): boolean {
    const totalLoad = this.activeRequests.size + this.requestQueue.length;
    const maxCapacity = this.config.maxConcurrentRequests + this.config.queueSize;
    return totalLoad < maxCapacity;
  }

  /**
   * Check if graceful degradation should be applied
   */
  public shouldDegrade(): boolean {
    if (!this.config.enableGracefulDegradation) {
      return false;
    }

    return this.metrics.currentLoad >= this.config.degradationThreshold;
  }

  /**
   * Get degraded service recommendations
   */
  public getDegradationRecommendations(): {
    skipNonEssential: boolean;
    reduceQuality: boolean;
    cacheOnly: boolean;
  } {
    const load = this.metrics.currentLoad;

    return {
      skipNonEssential: load >= 70,
      reduceQuality: load >= 80,
      cacheOnly: load >= 90,
    };
  }

  /**
   * Clean up expired requests
   */
  public cleanupExpiredRequests(): number {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up active requests
    for (const [requestId, context] of this.activeRequests.entries()) {
      if (now - context.timestamp > context.timeout) {
        this.activeRequests.delete(requestId);
        this.metrics.failedRequests++;
        cleanedCount++;
        logger.warn('Request timed out', { requestId, age: now - context.timestamp });
      }
    }

    // Clean up queued requests
    const originalQueueSize = this.requestQueue.length;
    this.requestQueue = this.requestQueue.filter(context => {
      const expired = now - context.timestamp > context.timeout;
      if (expired) {
        this.metrics.failedRequests++;
        cleanedCount++;
        logger.warn('Queued request expired', { requestId: context.requestId });
      }
      return !expired;
    });

    if (cleanedCount > 0) {
      this.updateMetrics();
      logger.info('Cleaned up expired requests', { count: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Get configuration
   */
  public getConfig(): ConcurrencyConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<ConcurrencyConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('Concurrency configuration updated', updates);
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics.completedRequests = 0;
    this.metrics.failedRequests = 0;
    this.responseTimes = [];
    this.metrics.averageResponseTime = 0;
    logger.info('Metrics reset');
  }

  /**
   * Get service status
   */
  public getStatus(): {
    healthy: boolean;
    mode: ServiceMode;
    metrics: RequestMetrics;
    config: ConcurrencyConfig;
  } {
    return {
      healthy: this.serviceMode !== ServiceMode.OVERLOADED,
      mode: this.serviceMode,
      metrics: this.getMetrics(),
      config: this.getConfig(),
    };
  }

  /**
   * Process next queued request
   */
  private processNextQueuedRequest(): void {
    if (this.requestQueue.length === 0) {
      return;
    }

    if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
      return;
    }

    const context = this.requestQueue.shift();
    if (context) {
      this.activeRequests.set(context.requestId, context);
      logger.debug('Queued request promoted to active', {
        requestId: context.requestId,
        queueSize: this.requestQueue.length,
      });
    }
  }

  /**
   * Sort queue by priority
   */
  private sortQueueByPriority(): void {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    this.requestQueue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      // Same priority, sort by timestamp (FIFO)
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    this.metrics.activeRequests = this.activeRequests.size;
    this.metrics.queuedRequests = this.requestQueue.length;

    const maxCapacity = this.config.maxConcurrentRequests + this.config.queueSize;
    const currentUsage = this.metrics.activeRequests + this.metrics.queuedRequests;
    this.metrics.currentLoad = Math.round((currentUsage / maxCapacity) * 100);

    this.updateServiceMode();
  }

  /**
   * Update service mode based on current load
   */
  private updateServiceMode(): void {
    const load = this.metrics.currentLoad;
    const previousMode = this.serviceMode;

    if (load >= 95) {
      this.serviceMode = ServiceMode.OVERLOADED;
    } else if (load >= this.config.degradationThreshold) {
      this.serviceMode = ServiceMode.DEGRADED;
    } else {
      this.serviceMode = ServiceMode.NORMAL;
    }

    if (previousMode !== this.serviceMode) {
      logger.info('Service mode changed', {
        from: previousMode,
        to: this.serviceMode,
        load: this.metrics.currentLoad,
      });
    }
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) {
      return 0;
    }

    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / this.responseTimes.length);
  }
}

/**
 * Factory function to create ConcurrencyManagementService
 */
export function createConcurrencyManagementService(
  config?: Partial<ConcurrencyConfig>
): ConcurrencyManagementService {
  return new ConcurrencyManagementService(config);
}
