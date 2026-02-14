import {
  ConcurrencyManagementService,
  ConcurrencyConfig,
  ServiceMode,
} from '../../src/services/concurrency-management-service';

describe('ConcurrencyManagementService', () => {
  let service: ConcurrencyManagementService;

  beforeEach(() => {
    service = new ConcurrencyManagementService({
      maxConcurrentRequests: 10,
      requestTimeout: 5000,
      queueSize: 5,
      enableGracefulDegradation: true,
      degradationThreshold: 80,
    });
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const defaultService = new ConcurrencyManagementService();
      const config = defaultService.getConfig();

      expect(config.maxConcurrentRequests).toBe(1000);
      expect(config.requestTimeout).toBe(30000);
      expect(config.queueSize).toBe(500);
      expect(config.enableGracefulDegradation).toBe(true);
      expect(config.degradationThreshold).toBe(80);
    });

    it('should initialize with custom config', () => {
      const config = service.getConfig();

      expect(config.maxConcurrentRequests).toBe(10);
      expect(config.requestTimeout).toBe(5000);
      expect(config.queueSize).toBe(5);
    });

    it('should start in normal mode', () => {
      expect(service.getServiceMode()).toBe(ServiceMode.NORMAL);
    });

    it('should have zero metrics initially', () => {
      const metrics = service.getMetrics();

      expect(metrics.activeRequests).toBe(0);
      expect(metrics.queuedRequests).toBe(0);
      expect(metrics.completedRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.currentLoad).toBe(0);
    });
  });

  describe('acquireRequestSlot', () => {
    it('should acquire slot when capacity available', async () => {
      const result = await service.acquireRequestSlot('req1');

      expect(result).toBe(true);
      expect(service.getMetrics().activeRequests).toBe(1);
    });

    it('should acquire multiple slots', async () => {
      await service.acquireRequestSlot('req1');
      await service.acquireRequestSlot('req2');
      await service.acquireRequestSlot('req3');

      expect(service.getMetrics().activeRequests).toBe(3);
    });

    it('should queue requests when at max capacity', async () => {
      // Fill up active slots
      for (let i = 0; i < 10; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      // Next request should be queued
      const result = await service.acquireRequestSlot('req10');

      expect(result).toBe(true);
      expect(service.getMetrics().activeRequests).toBe(10);
      expect(service.getMetrics().queuedRequests).toBe(1);
    });

    it('should reject requests when queue is full', async () => {
      // Fill up active slots and queue
      for (let i = 0; i < 15; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      // Next request should be rejected
      const result = await service.acquireRequestSlot('req15');

      expect(result).toBe(false);
      expect(service.getMetrics().failedRequests).toBe(1);
    });

    it('should respect priority in queue', async () => {
      // Fill up active slots
      for (let i = 0; i < 10; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      // Queue requests with different priorities
      await service.acquireRequestSlot('low1', 'low');
      await service.acquireRequestSlot('high1', 'high');
      await service.acquireRequestSlot('normal1', 'normal');

      expect(service.getMetrics().queuedRequests).toBe(3);
    });
  });

  describe('releaseRequestSlot', () => {
    it('should release active request slot', async () => {
      await service.acquireRequestSlot('req1');
      service.releaseRequestSlot('req1');

      expect(service.getMetrics().activeRequests).toBe(0);
      expect(service.getMetrics().completedRequests).toBe(1);
    });

    it('should track response time', async () => {
      await service.acquireRequestSlot('req1');
      service.releaseRequestSlot('req1', 100);

      const metrics = service.getMetrics();
      expect(metrics.averageResponseTime).toBe(100);
    });

    it('should calculate average response time', async () => {
      await service.acquireRequestSlot('req1');
      service.releaseRequestSlot('req1', 100);

      await service.acquireRequestSlot('req2');
      service.releaseRequestSlot('req2', 200);

      const metrics = service.getMetrics();
      expect(metrics.averageResponseTime).toBe(150);
    });

    it('should promote queued request when slot released', async () => {
      // Fill up active slots
      for (let i = 0; i < 10; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      // Queue a request
      await service.acquireRequestSlot('queued1');
      expect(service.getMetrics().queuedRequests).toBe(1);

      // Release a slot
      service.releaseRequestSlot('req0');

      // Queued request should be promoted
      expect(service.getMetrics().activeRequests).toBe(10);
      expect(service.getMetrics().queuedRequests).toBe(0);
    });

    it('should handle releasing non-existent request', () => {
      service.releaseRequestSlot('non-existent');

      expect(service.getMetrics().completedRequests).toBe(0);
    });
  });

  describe('markRequestFailed', () => {
    it('should mark active request as failed', async () => {
      await service.acquireRequestSlot('req1');
      service.markRequestFailed('req1');

      expect(service.getMetrics().activeRequests).toBe(0);
      expect(service.getMetrics().failedRequests).toBe(1);
    });

    it('should promote queued request after failure', async () => {
      // Fill up active slots
      for (let i = 0; i < 10; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      // Queue a request
      await service.acquireRequestSlot('queued1');

      // Mark one as failed
      service.markRequestFailed('req0');

      // Queued request should be promoted
      expect(service.getMetrics().activeRequests).toBe(10);
      expect(service.getMetrics().queuedRequests).toBe(0);
    });
  });

  describe('service mode', () => {
    it('should be in normal mode at low load', () => {
      expect(service.getServiceMode()).toBe(ServiceMode.NORMAL);
    });

    it('should switch to degraded mode at high load', async () => {
      // Fill to 80% capacity (12 out of 15 total)
      for (let i = 0; i < 12; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      expect(service.getServiceMode()).toBe(ServiceMode.DEGRADED);
    });

    it('should switch to overloaded mode at very high load', async () => {
      // Fill to 95% capacity (15 out of 15 total - completely full)
      for (let i = 0; i < 15; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      expect(service.getServiceMode()).toBe(ServiceMode.OVERLOADED);
    });

    it('should return to normal mode when load decreases', async () => {
      // Fill to high load
      for (let i = 0; i < 12; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      expect(service.getServiceMode()).toBe(ServiceMode.DEGRADED);

      // Release requests
      for (let i = 0; i < 10; i++) {
        service.releaseRequestSlot(`req${i}`);
      }

      expect(service.getServiceMode()).toBe(ServiceMode.NORMAL);
    });
  });

  describe('canAcceptRequest', () => {
    it('should accept requests when capacity available', () => {
      expect(service.canAcceptRequest()).toBe(true);
    });

    it('should not accept requests when at full capacity', async () => {
      // Fill up all slots
      for (let i = 0; i < 15; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      expect(service.canAcceptRequest()).toBe(false);
    });
  });

  describe('shouldDegrade', () => {
    it('should not degrade at low load', () => {
      expect(service.shouldDegrade()).toBe(false);
    });

    it('should degrade at high load', async () => {
      // Fill to 80% capacity
      for (let i = 0; i < 12; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      expect(service.shouldDegrade()).toBe(true);
    });

    it('should respect degradation config', () => {
      const noDegrade = new ConcurrencyManagementService({
        maxConcurrentRequests: 10,
        enableGracefulDegradation: false,
      });

      expect(noDegrade.shouldDegrade()).toBe(false);
    });
  });

  describe('getDegradationRecommendations', () => {
    it('should recommend no degradation at low load', () => {
      const recommendations = service.getDegradationRecommendations();

      expect(recommendations.skipNonEssential).toBe(false);
      expect(recommendations.reduceQuality).toBe(false);
      expect(recommendations.cacheOnly).toBe(false);
    });

    it('should recommend skipping non-essential at 70% load', async () => {
      // Fill to 70% capacity (10-11 out of 15)
      for (let i = 0; i < 11; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      const recommendations = service.getDegradationRecommendations();

      expect(recommendations.skipNonEssential).toBe(true);
      expect(recommendations.reduceQuality).toBe(false);
    });

    it('should recommend reducing quality at 80% load', async () => {
      // Fill to 80% capacity (12 out of 15)
      for (let i = 0; i < 12; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      const recommendations = service.getDegradationRecommendations();

      expect(recommendations.skipNonEssential).toBe(true);
      expect(recommendations.reduceQuality).toBe(true);
      expect(recommendations.cacheOnly).toBe(false);
    });

    it('should recommend cache-only at 90% load', async () => {
      // Fill to 90% capacity (13-14 out of 15)
      for (let i = 0; i < 14; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      const recommendations = service.getDegradationRecommendations();

      expect(recommendations.skipNonEssential).toBe(true);
      expect(recommendations.reduceQuality).toBe(true);
      expect(recommendations.cacheOnly).toBe(true);
    });
  });

  describe('cleanupExpiredRequests', () => {
    it('should clean up expired active requests', async () => {
      await service.acquireRequestSlot('req1');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 5100));

      const cleaned = service.cleanupExpiredRequests();

      expect(cleaned).toBe(1);
      expect(service.getMetrics().activeRequests).toBe(0);
      expect(service.getMetrics().failedRequests).toBe(1);
    }, 10000); // 10 second timeout

    it('should clean up expired queued requests', async () => {
      // Fill up active slots
      for (let i = 0; i < 10; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      // Queue a request
      await service.acquireRequestSlot('queued1');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 5100));

      const cleaned = service.cleanupExpiredRequests();

      expect(cleaned).toBeGreaterThan(0);
    }, 10000); // 10 second timeout

    it('should not clean up non-expired requests', async () => {
      await service.acquireRequestSlot('req1');

      const cleaned = service.cleanupExpiredRequests();

      expect(cleaned).toBe(0);
      expect(service.getMetrics().activeRequests).toBe(1);
    });
  });

  describe('configuration', () => {
    it('should get current configuration', () => {
      const config = service.getConfig();

      expect(config.maxConcurrentRequests).toBe(10);
      expect(config.queueSize).toBe(5);
    });

    it('should update configuration', () => {
      service.updateConfig({
        maxConcurrentRequests: 20,
        queueSize: 10,
      });

      const config = service.getConfig();

      expect(config.maxConcurrentRequests).toBe(20);
      expect(config.queueSize).toBe(10);
    });
  });

  describe('metrics', () => {
    it('should track active requests', async () => {
      await service.acquireRequestSlot('req1');
      await service.acquireRequestSlot('req2');

      const metrics = service.getMetrics();

      expect(metrics.activeRequests).toBe(2);
    });

    it('should track queued requests', async () => {
      // Fill active slots
      for (let i = 0; i < 10; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      // Queue requests
      await service.acquireRequestSlot('queued1');
      await service.acquireRequestSlot('queued2');

      const metrics = service.getMetrics();

      expect(metrics.queuedRequests).toBe(2);
    });

    it('should track completed requests', async () => {
      await service.acquireRequestSlot('req1');
      service.releaseRequestSlot('req1');

      await service.acquireRequestSlot('req2');
      service.releaseRequestSlot('req2');

      const metrics = service.getMetrics();

      expect(metrics.completedRequests).toBe(2);
    });

    it('should track failed requests', async () => {
      await service.acquireRequestSlot('req1');
      service.markRequestFailed('req1');

      const metrics = service.getMetrics();

      expect(metrics.failedRequests).toBe(1);
    });

    it('should calculate current load', async () => {
      // Fill to 50% capacity (7-8 out of 15)
      for (let i = 0; i < 8; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      const metrics = service.getMetrics();

      expect(metrics.currentLoad).toBeGreaterThanOrEqual(50);
      expect(metrics.currentLoad).toBeLessThanOrEqual(60);
    });

    it('should reset metrics', async () => {
      await service.acquireRequestSlot('req1');
      service.releaseRequestSlot('req1', 100);

      service.resetMetrics();

      const metrics = service.getMetrics();

      expect(metrics.completedRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return service status', () => {
      const status = service.getStatus();

      expect(status.healthy).toBe(true);
      expect(status.mode).toBe(ServiceMode.NORMAL);
      expect(status.metrics).toBeDefined();
      expect(status.config).toBeDefined();
    });

    it('should indicate unhealthy when overloaded', async () => {
      // Fill to overload (15 out of 15 - completely full)
      for (let i = 0; i < 15; i++) {
        await service.acquireRequestSlot(`req${i}`);
      }

      const status = service.getStatus();

      expect(status.healthy).toBe(false);
      expect(status.mode).toBe(ServiceMode.OVERLOADED);
    });
  });
});
