// Unit tests for NetworkAwareDeliveryService
import { NetworkAwareDeliveryService } from '../../src/services/network-aware-delivery-service';

jest.mock('../../src/utils/logger');

describe('NetworkAwareDeliveryService', () => {
  let service: NetworkAwareDeliveryService;

  beforeEach(() => {
    service = new NetworkAwareDeliveryService();
  });

  describe('updateNetworkConditions', () => {
    it('should update network conditions', () => {
      service.updateNetworkConditions({
        bandwidth: 50,
        latency: 20,
        isOnline: true,
      });

      const conditions = service.getNetworkConditions();
      expect(conditions.bandwidth).toBe(50);
      expect(conditions.latency).toBe(20);
      expect(conditions.isOnline).toBe(true);
      expect(conditions.quality).toBe('excellent');
    });

    it('should set quality to offline when not online', () => {
      service.updateNetworkConditions({
        isOnline: false,
      });

      const conditions = service.getNetworkConditions();
      expect(conditions.quality).toBe('offline');
    });

    it('should determine excellent quality', () => {
      service.updateNetworkConditions({
        bandwidth: 30,
        latency: 25,
        isOnline: true,
      });

      const conditions = service.getNetworkConditions();
      expect(conditions.quality).toBe('excellent');
    });

    it('should determine good quality', () => {
      service.updateNetworkConditions({
        bandwidth: 15,
        latency: 80,
        isOnline: true,
      });

      const conditions = service.getNetworkConditions();
      expect(conditions.quality).toBe('good');
    });

    it('should determine fair quality', () => {
      service.updateNetworkConditions({
        bandwidth: 5,
        latency: 200,
        isOnline: true,
      });

      const conditions = service.getNetworkConditions();
      expect(conditions.quality).toBe('fair');
    });

    it('should determine poor quality', () => {
      service.updateNetworkConditions({
        bandwidth: 1,
        latency: 500,
        isOnline: true,
      });

      const conditions = service.getNetworkConditions();
      expect(conditions.quality).toBe('poor');
    });
  });

  describe('getAdaptiveQualityRecommendation', () => {
    it('should recommend ultra quality for excellent network', () => {
      service.updateNetworkConditions({
        bandwidth: 30,
        latency: 20,
        isOnline: true,
      });

      const recommendation = service.getAdaptiveQualityRecommendation({
        contentType: 'video',
        priority: 'medium',
        size: 10 * 1024 * 1024, // 10MB
        duration: 60,
      });

      expect(recommendation.recommendedQuality).toBe('ultra');
      expect(recommendation.fallbackQuality).toBe('high');
    });

    it('should recommend high quality for good network with video', () => {
      service.updateNetworkConditions({
        bandwidth: 15,
        latency: 80,
        isOnline: true,
      });

      const recommendation = service.getAdaptiveQualityRecommendation({
        contentType: 'video',
        priority: 'medium',
        size: 10 * 1024 * 1024,
        duration: 60,
      });

      expect(recommendation.recommendedQuality).toBe('high');
      expect(recommendation.fallbackQuality).toBe('medium');
    });

    it('should recommend medium quality for fair network', () => {
      service.updateNetworkConditions({
        bandwidth: 5,
        latency: 200,
        isOnline: true,
      });

      const recommendation = service.getAdaptiveQualityRecommendation({
        contentType: 'video',
        priority: 'medium',
        size: 10 * 1024 * 1024,
        duration: 60,
      });

      expect(recommendation.recommendedQuality).toBe('medium');
      expect(recommendation.fallbackQuality).toBe('low');
    });

    it('should recommend low quality for poor network', () => {
      service.updateNetworkConditions({
        bandwidth: 1,
        latency: 500,
        isOnline: true,
      });

      const recommendation = service.getAdaptiveQualityRecommendation({
        contentType: 'video',
        priority: 'medium',
        size: 10 * 1024 * 1024,
        duration: 60,
      });

      expect(recommendation.recommendedQuality).toBe('low');
      expect(recommendation.fallbackQuality).toBeUndefined();
    });

    it('should upgrade quality for critical priority content', () => {
      service.updateNetworkConditions({
        bandwidth: 5,
        latency: 200,
        isOnline: true,
      });

      const recommendation = service.getAdaptiveQualityRecommendation({
        contentType: 'video',
        priority: 'critical',
        size: 10 * 1024 * 1024,
        duration: 60,
      });

      expect(recommendation.recommendedQuality).toBe('high');
    });

    it('should recommend progressive loading for slow networks', () => {
      service.updateNetworkConditions({
        bandwidth: 5,
        latency: 200,
        isOnline: true,
      });

      const recommendation = service.getAdaptiveQualityRecommendation({
        contentType: 'video',
        priority: 'medium',
        size: 50 * 1024 * 1024, // 50MB
        duration: 300,
      });

      expect(recommendation.shouldUseProgressive).toBe(true);
    });

    it('should not recommend progressive loading for excellent networks', () => {
      service.updateNetworkConditions({
        bandwidth: 30,
        latency: 20,
        isOnline: true,
      });

      const recommendation = service.getAdaptiveQualityRecommendation({
        contentType: 'video',
        priority: 'medium',
        size: 50 * 1024 * 1024,
        duration: 300,
      });

      expect(recommendation.shouldUseProgressive).toBe(false);
    });

    it('should recommend caching for critical content', () => {
      service.updateNetworkConditions({
        bandwidth: 15,
        latency: 80,
        isOnline: true,
      });

      const recommendation = service.getAdaptiveQualityRecommendation({
        contentType: 'video',
        priority: 'critical',
        size: 10 * 1024 * 1024,
        duration: 60,
      });

      expect(recommendation.shouldCache).toBe(true);
    });

    it('should handle offline scenario', () => {
      service.updateNetworkConditions({
        isOnline: false,
      });

      const recommendation = service.getAdaptiveQualityRecommendation({
        contentType: 'video',
        priority: 'medium',
        size: 10 * 1024 * 1024,
        duration: 60,
      });

      expect(recommendation.recommendedQuality).toBe('low');
      expect(recommendation.estimatedLoadTime).toBe(Infinity);
      expect(recommendation.shouldCache).toBe(true);
    });
  });

  describe('getProgressiveLoadingStrategy', () => {
    it('should return large chunks for excellent network', () => {
      service.updateNetworkConditions({
        bandwidth: 30,
        latency: 20,
        isOnline: true,
      });

      const strategy = service.getProgressiveLoadingStrategy(
        100 * 1024 * 1024,
        'video'
      );

      expect(strategy.chunkSize).toBe(2 * 1024 * 1024);
      expect(strategy.initialChunks).toBe(3);
      expect(strategy.prefetchChunks).toBe(5);
    });

    it('should return medium chunks for good network', () => {
      service.updateNetworkConditions({
        bandwidth: 15,
        latency: 80,
        isOnline: true,
      });

      const strategy = service.getProgressiveLoadingStrategy(
        100 * 1024 * 1024,
        'video'
      );

      expect(strategy.chunkSize).toBe(1 * 1024 * 1024);
      expect(strategy.initialChunks).toBe(2);
      expect(strategy.prefetchChunks).toBe(3);
    });

    it('should return small chunks for poor network', () => {
      service.updateNetworkConditions({
        bandwidth: 1,
        latency: 500,
        isOnline: true,
      });

      const strategy = service.getProgressiveLoadingStrategy(
        100 * 1024 * 1024,
        'video'
      );

      expect(strategy.chunkSize).toBe(256 * 1024);
      expect(strategy.initialChunks).toBe(1);
      expect(strategy.prefetchChunks).toBe(1);
    });

    it('should use smaller chunks for audio', () => {
      service.updateNetworkConditions({
        bandwidth: 15,
        latency: 80,
        isOnline: true,
      });

      const videoStrategy = service.getProgressiveLoadingStrategy(
        100 * 1024 * 1024,
        'video'
      );
      const audioStrategy = service.getProgressiveLoadingStrategy(
        100 * 1024 * 1024,
        'audio'
      );

      expect(audioStrategy.chunkSize).toBe(videoStrategy.chunkSize / 2);
    });

    it('should calculate buffer size as 3x chunk size', () => {
      service.updateNetworkConditions({
        bandwidth: 15,
        latency: 80,
        isOnline: true,
      });

      const strategy = service.getProgressiveLoadingStrategy(
        100 * 1024 * 1024,
        'video'
      );

      expect(strategy.bufferSize).toBe(strategy.chunkSize * 3);
    });
  });

  describe('prioritizeContent', () => {
    it('should prioritize by priority level', () => {
      const items = [
        { id: 'low-1', priority: 'low' as const, size: 1000 },
        { id: 'critical-1', priority: 'critical' as const, size: 5000 },
        { id: 'high-1', priority: 'high' as const, size: 3000 },
        { id: 'medium-1', priority: 'medium' as const, size: 2000 },
      ];

      const prioritized = service.prioritizeContent(items);

      expect(prioritized[0]).toBe('critical-1');
      expect(prioritized[1]).toBe('high-1');
      expect(prioritized[2]).toBe('medium-1');
      expect(prioritized[3]).toBe('low-1');
    });

    it('should prioritize smaller content on poor networks', () => {
      service.updateNetworkConditions({
        bandwidth: 1,
        latency: 500,
        isOnline: true,
      });

      const items = [
        { id: 'large', priority: 'medium' as const, size: 10000 },
        { id: 'small', priority: 'medium' as const, size: 1000 },
      ];

      const prioritized = service.prioritizeContent(items);

      expect(prioritized[0]).toBe('small');
      expect(prioritized[1]).toBe('large');
    });

    it('should not prioritize by size on good networks', () => {
      service.updateNetworkConditions({
        bandwidth: 30,
        latency: 20,
        isOnline: true,
      });

      const items = [
        { id: 'large', priority: 'medium' as const, size: 10000 },
        { id: 'small', priority: 'medium' as const, size: 1000 },
      ];

      const prioritized = service.prioritizeContent(items);

      // Order should be maintained when priority is same on good networks
      expect(prioritized).toHaveLength(2);
    });
  });

  describe('shouldActivateOfflineMode', () => {
    it('should return true when offline', () => {
      service.updateNetworkConditions({
        isOnline: false,
      });

      expect(service.shouldActivateOfflineMode()).toBe(true);
    });

    it('should return false when online', () => {
      service.updateNetworkConditions({
        bandwidth: 15,
        latency: 80,
        isOnline: true,
      });

      expect(service.shouldActivateOfflineMode()).toBe(false);
    });
  });

  describe('getGracefulDegradationStrategy', () => {
    it('should return offline strategy when offline', () => {
      service.updateNetworkConditions({
        isOnline: false,
      });

      const strategy = service.getGracefulDegradationStrategy('video');

      expect(strategy.fallbackContent).toContain('cached-content');
      expect(strategy.userMessage).toContain('offline');
    });

    it('should return poor network strategy', () => {
      service.updateNetworkConditions({
        bandwidth: 1,
        latency: 500,
        isOnline: true,
      });

      const strategy = service.getGracefulDegradationStrategy('video');

      expect(strategy.fallbackContent).toContain('low-quality-media');
      expect(strategy.userMessage).toContain('slow');
    });

    it('should return fair network strategy', () => {
      service.updateNetworkConditions({
        bandwidth: 5,
        latency: 200,
        isOnline: true,
      });

      const strategy = service.getGracefulDegradationStrategy('video');

      expect(strategy.fallbackContent).toContain('medium-quality-media');
      expect(strategy.userMessage).toContain('limited');
    });

    it('should return empty strategy for good networks', () => {
      service.updateNetworkConditions({
        bandwidth: 15,
        latency: 80,
        isOnline: true,
      });

      const strategy = service.getGracefulDegradationStrategy('video');

      expect(strategy.fallbackContent).toHaveLength(0);
      expect(strategy.userMessage).toBe('');
    });
  });

  describe('estimateDownloadTime', () => {
    it('should estimate download time correctly', () => {
      service.updateNetworkConditions({
        bandwidth: 10, // 10 Mbps
        latency: 50,
        isOnline: true,
      });

      const size = 10 * 1024 * 1024; // 10MB
      const estimatedTime = service.estimateDownloadTime(size);

      // 10 Mbps = 1.25 MB/s, so 10MB should take 8 seconds
      expect(estimatedTime).toBeCloseTo(8, 0);
    });

    it('should handle different bandwidth values', () => {
      service.updateNetworkConditions({
        bandwidth: 1, // 1 Mbps
        latency: 50,
        isOnline: true,
      });

      const size = 1 * 1024 * 1024; // 1MB
      const estimatedTime = service.estimateDownloadTime(size);

      // 1 Mbps = 0.125 MB/s, so 1MB should take 8 seconds
      expect(estimatedTime).toBeCloseTo(8, 0);
    });
  });

  describe('shouldPreloadContent', () => {
    it('should preload critical content when online', () => {
      service.updateNetworkConditions({
        bandwidth: 5,
        latency: 200,
        isOnline: true,
      });

      const shouldPreload = service.shouldPreloadContent('critical', 1000000);

      expect(shouldPreload).toBe(true);
    });

    it('should not preload critical content when offline', () => {
      service.updateNetworkConditions({
        isOnline: false,
      });

      const shouldPreload = service.shouldPreloadContent('critical', 1000000);

      expect(shouldPreload).toBe(false);
    });

    it('should preload high priority on good networks', () => {
      service.updateNetworkConditions({
        bandwidth: 30,
        latency: 20,
        isOnline: true,
      });

      const shouldPreload = service.shouldPreloadContent('high', 1000000);

      expect(shouldPreload).toBe(true);
    });

    it('should not preload on poor networks', () => {
      service.updateNetworkConditions({
        bandwidth: 1,
        latency: 500,
        isOnline: true,
      });

      const shouldPreload = service.shouldPreloadContent('medium', 1000000);

      expect(shouldPreload).toBe(false);
    });

    it('should not preload large files', () => {
      service.updateNetworkConditions({
        bandwidth: 10,
        latency: 50,
        isOnline: true,
      });

      const largeSize = 100 * 1024 * 1024; // 100MB
      const shouldPreload = service.shouldPreloadContent('medium', largeSize);

      expect(shouldPreload).toBe(false);
    });

    it('should preload small files on good networks', () => {
      service.updateNetworkConditions({
        bandwidth: 10,
        latency: 50,
        isOnline: true,
      });

      const smallSize = 1 * 1024 * 1024; // 1MB
      const shouldPreload = service.shouldPreloadContent('medium', smallSize);

      expect(shouldPreload).toBe(true);
    });
  });
});
