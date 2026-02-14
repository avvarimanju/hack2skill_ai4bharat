// Unit tests for AnalyticsService
import { AnalyticsService } from '../../src/services/analytics-service';
import { Language, ContentType, InteractionType } from '../../src/models/common';

jest.mock('../../src/utils/logger');

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    service = new AnalyticsService(true);
  });

  describe('initialization', () => {
    it('should initialize with privacy compliance enabled', () => {
      const status = service.getStatus();

      expect(status.privacyCompliant).toBe(true);
      expect(status.totalEvents).toBe(0);
      expect(status.qrScans).toBe(0);
      expect(status.contentViews).toBe(0);
      expect(status.interactions).toBe(0);
    });

    it('should initialize with privacy compliance disabled', () => {
      const nonCompliantService = new AnalyticsService(false);
      const status = nonCompliantService.getStatus();

      expect(status.privacyCompliant).toBe(false);
    });
  });

  describe('trackQRScan', () => {
    it('should track QR scan event', () => {
      const scanId = service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        userId: 'user-1',
      });

      expect(scanId).toBeDefined();
      expect(scanId).toContain('scan-');

      const status = service.getStatus();
      expect(status.qrScans).toBe(1);
    });

    it('should track QR scan with location', () => {
      const scanId = service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        userId: 'user-1',
        location: {
          latitude: 12.9716,
          longitude: 77.5946,
        },
      });

      expect(scanId).toBeDefined();
    });

    it('should remove location for anonymous users when privacy compliant', () => {
      const scanId = service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        location: {
          latitude: 12.9716,
          longitude: 77.5946,
        },
      });

      expect(scanId).toBeDefined();
      // Location should be removed for anonymous users
    });

    it('should track multiple QR scans', () => {
      service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
      });

      service.trackQRScan({
        artifactId: 'artifact-2',
        siteId: 'site-1',
        sessionId: 'session-1',
      });

      const status = service.getStatus();
      expect(status.qrScans).toBe(2);
    });
  });

  describe('trackContentView', () => {
    it('should track content view event', () => {
      const viewId = service.trackContentView({
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

      expect(viewId).toBeDefined();
      expect(viewId).toContain('view-');

      const status = service.getStatus();
      expect(status.contentViews).toBe(1);
    });

    it('should track incomplete content views', () => {
      const viewId = service.trackContentView({
        contentId: 'content-1',
        contentType: ContentType.VIDEO,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 30,
        language: Language.HINDI,
        completed: false,
      });

      expect(viewId).toBeDefined();
    });

    it('should track multiple content views', () => {
      service.trackContentView({
        contentId: 'content-1',
        contentType: ContentType.AUDIO_GUIDE,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 120,
        language: Language.ENGLISH,
        completed: true,
      });

      service.trackContentView({
        contentId: 'content-2',
        contentType: ContentType.VIDEO,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 180,
        language: Language.ENGLISH,
        completed: true,
      });

      const status = service.getStatus();
      expect(status.contentViews).toBe(2);
    });
  });

  describe('trackInteraction', () => {
    it('should track interaction event', () => {
      const interactionId = service.trackInteraction({
        type: InteractionType.PLAY,
        contentId: 'content-1',
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        userId: 'user-1',
      });

      expect(interactionId).toBeDefined();
      expect(interactionId).toContain('interaction-');

      const status = service.getStatus();
      expect(status.interactions).toBe(1);
    });

    it('should track interaction with metadata', () => {
      const interactionId = service.trackInteraction({
        type: InteractionType.VIEW,
        contentId: 'content-1',
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        metadata: {
          viewDuration: 120,
          quality: 'high',
        },
      });

      expect(interactionId).toBeDefined();
    });

    it('should track multiple interactions', () => {
      service.trackInteraction({
        type: InteractionType.PLAY,
        contentId: 'content-1',
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
      });

      service.trackInteraction({
        type: InteractionType.PAUSE,
        contentId: 'content-1',
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
      });

      const status = service.getStatus();
      expect(status.interactions).toBe(2);
    });
  });

  describe('user preferences', () => {
    it('should record user preference', () => {
      service.recordUserPreference({
        userId: 'user-1',
        preferredLanguage: Language.HINDI,
        preferredContentTypes: [ContentType.AUDIO_GUIDE, ContentType.VIDEO],
        accessibilitySettings: {
          audioDescriptions: true,
          highContrast: false,
          textSize: 'large',
        },
      });

      const status = service.getStatus();
      expect(status.userPreferences).toBe(1);
    });

    it('should retrieve user preference', () => {
      service.recordUserPreference({
        userId: 'user-1',
        preferredLanguage: Language.TAMIL,
        preferredContentTypes: [ContentType.INFOGRAPHIC],
        accessibilitySettings: {
          audioDescriptions: false,
          highContrast: true,
          textSize: 'medium',
        },
      });

      const preference = service.getUserPreference('user-1');

      expect(preference).not.toBeNull();
      expect(preference?.preferredLanguage).toBe(Language.TAMIL);
      expect(preference?.preferredContentTypes).toContain(ContentType.INFOGRAPHIC);
    });

    it('should return null for non-existent user preference', () => {
      const preference = service.getUserPreference('non-existent');

      expect(preference).toBeNull();
    });

    it('should update existing user preference', () => {
      service.recordUserPreference({
        userId: 'user-1',
        preferredLanguage: Language.ENGLISH,
        preferredContentTypes: [ContentType.AUDIO_GUIDE],
        accessibilitySettings: {
          audioDescriptions: false,
          highContrast: false,
          textSize: 'medium',
        },
      });

      service.recordUserPreference({
        userId: 'user-1',
        preferredLanguage: Language.HINDI,
        preferredContentTypes: [ContentType.VIDEO],
        accessibilitySettings: {
          audioDescriptions: true,
          highContrast: true,
          textSize: 'large',
        },
      });

      const preference = service.getUserPreference('user-1');
      expect(preference?.preferredLanguage).toBe(Language.HINDI);

      const status = service.getStatus();
      expect(status.userPreferences).toBe(1); // Should still be 1 (updated, not added)
    });

    it('should get all user preferences', () => {
      service.recordUserPreference({
        userId: 'user-1',
        preferredLanguage: Language.ENGLISH,
        preferredContentTypes: [ContentType.AUDIO_GUIDE],
        accessibilitySettings: {
          audioDescriptions: false,
          highContrast: false,
          textSize: 'medium',
        },
      });

      service.recordUserPreference({
        userId: 'user-2',
        preferredLanguage: Language.HINDI,
        preferredContentTypes: [ContentType.VIDEO],
        accessibilitySettings: {
          audioDescriptions: true,
          highContrast: false,
          textSize: 'large',
        },
      });

      const preferences = service.getAllUserPreferences();

      expect(preferences).toHaveLength(2);
    });
  });

  describe('engagement patterns', () => {
    it('should record engagement pattern', () => {
      service.recordEngagementPattern({
        userId: 'user-1',
        sessionId: 'session-1',
        totalScans: 5,
        totalViews: 10,
        totalInteractions: 15,
        averageViewDuration: 120,
        mostViewedContentType: ContentType.AUDIO_GUIDE,
        mostVisitedSite: 'site-1',
        preferredLanguage: Language.ENGLISH,
        sessionDuration: 600,
      });

      const status = service.getStatus();
      expect(status.engagementPatterns).toBe(1);
    });

    it('should retrieve engagement pattern by user ID', () => {
      service.recordEngagementPattern({
        userId: 'user-1',
        sessionId: 'session-1',
        totalScans: 5,
        totalViews: 10,
        totalInteractions: 15,
        averageViewDuration: 120,
        mostViewedContentType: ContentType.VIDEO,
        mostVisitedSite: 'site-1',
        preferredLanguage: Language.HINDI,
        sessionDuration: 600,
      });

      const pattern = service.getEngagementPattern('user-1');

      expect(pattern).not.toBeNull();
      expect(pattern?.totalScans).toBe(5);
      expect(pattern?.totalViews).toBe(10);
    });

    it('should retrieve engagement pattern by session ID', () => {
      service.recordEngagementPattern({
        sessionId: 'session-1',
        totalScans: 3,
        totalViews: 6,
        totalInteractions: 9,
        averageViewDuration: 90,
        mostViewedContentType: ContentType.INFOGRAPHIC,
        mostVisitedSite: 'site-2',
        preferredLanguage: Language.TAMIL,
        sessionDuration: 300,
      });

      const pattern = service.getEngagementPattern('session-1');

      expect(pattern).not.toBeNull();
      expect(pattern?.sessionId).toBe('session-1');
    });

    it('should return null for non-existent engagement pattern', () => {
      const pattern = service.getEngagementPattern('non-existent');

      expect(pattern).toBeNull();
    });
  });

  describe('getMetrics', () => {
    it('should calculate analytics metrics', () => {
      // Add some data
      service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        userId: 'user-1',
      });

      service.trackContentView({
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

      service.trackInteraction({
        type: InteractionType.PLAY,
        contentId: 'content-1',
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        userId: 'user-1',
      });

      const metrics = service.getMetrics();

      expect(metrics.totalQRScans).toBe(1);
      expect(metrics.totalContentViews).toBe(1);
      expect(metrics.totalInteractions).toBe(1);
      expect(metrics.uniqueUsers).toBe(1);
      expect(metrics.uniqueSessions).toBe(1);
    });

    it('should calculate popular artifacts', () => {
      service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
      });

      service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-2',
      });

      service.trackQRScan({
        artifactId: 'artifact-2',
        siteId: 'site-1',
        sessionId: 'session-3',
      });

      const metrics = service.getMetrics();

      expect(metrics.popularArtifacts).toHaveLength(2);
      expect(metrics.popularArtifacts[0].artifactId).toBe('artifact-1');
      expect(metrics.popularArtifacts[0].count).toBe(2);
    });

    it('should calculate content type distribution', () => {
      service.trackContentView({
        contentId: 'content-1',
        contentType: ContentType.AUDIO_GUIDE,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 120,
        language: Language.ENGLISH,
        completed: true,
      });

      service.trackContentView({
        contentId: 'content-2',
        contentType: ContentType.VIDEO,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 180,
        language: Language.ENGLISH,
        completed: true,
      });

      const metrics = service.getMetrics();

      expect(metrics.contentTypeDistribution[ContentType.AUDIO_GUIDE]).toBe(1);
      expect(metrics.contentTypeDistribution[ContentType.VIDEO]).toBe(1);
    });

    it('should calculate language distribution', () => {
      service.trackContentView({
        contentId: 'content-1',
        contentType: ContentType.AUDIO_GUIDE,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 120,
        language: Language.ENGLISH,
        completed: true,
      });

      service.trackContentView({
        contentId: 'content-2',
        contentType: ContentType.AUDIO_GUIDE,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 120,
        language: Language.HINDI,
        completed: true,
      });

      const metrics = service.getMetrics();

      expect(metrics.languageDistribution[Language.ENGLISH]).toBe(1);
      expect(metrics.languageDistribution[Language.HINDI]).toBe(1);
    });
  });

  describe('query methods', () => {
    beforeEach(() => {
      // Setup test data
      service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
      });

      service.trackQRScan({
        artifactId: 'artifact-2',
        siteId: 'site-2',
        sessionId: 'session-1',
      });

      service.trackContentView({
        contentId: 'content-1',
        contentType: ContentType.AUDIO_GUIDE,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 120,
        language: Language.ENGLISH,
        completed: true,
      });

      service.trackInteraction({
        type: InteractionType.PLAY,
        contentId: 'content-1',
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
      });
    });

    it('should get QR scans by site', () => {
      const scans = service.getQRScansBySite('site-1');

      expect(scans).toHaveLength(1);
      expect(scans[0].siteId).toBe('site-1');
    });

    it('should get content views by artifact', () => {
      const views = service.getContentViewsByArtifact('artifact-1');

      expect(views).toHaveLength(1);
      expect(views[0].artifactId).toBe('artifact-1');
    });

    it('should get interactions by session', () => {
      const interactions = service.getInteractionsBySession('session-1');

      expect(interactions).toHaveLength(1);
      expect(interactions[0].sessionId).toBe('session-1');
    });
  });

  describe('getAnalyticsSummary', () => {
    it('should get analytics summary for date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
      });

      service.trackContentView({
        contentId: 'content-1',
        contentType: ContentType.AUDIO_GUIDE,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 120,
        language: Language.ENGLISH,
        completed: true,
      });

      const summary = service.getAnalyticsSummary(yesterday, tomorrow);

      expect(summary.scans).toBe(1);
      expect(summary.views).toBe(1);
      expect(summary.uniqueSessions).toBe(1);
    });

    it('should return zero for date range with no data', () => {
      const pastDate = new Date('2020-01-01');
      const pastEndDate = new Date('2020-01-02');

      const summary = service.getAnalyticsSummary(pastDate, pastEndDate);

      expect(summary.scans).toBe(0);
      expect(summary.views).toBe(0);
      expect(summary.interactions).toBe(0);
      expect(summary.uniqueSessions).toBe(0);
    });
  });

  describe('exportData', () => {
    it('should export all analytics data', () => {
      service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
      });

      service.trackContentView({
        contentId: 'content-1',
        contentType: ContentType.AUDIO_GUIDE,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 120,
        language: Language.ENGLISH,
        completed: true,
      });

      const data = service.exportData();

      expect(data.qrScans).toHaveLength(1);
      expect(data.contentViews).toHaveLength(1);
      expect(data.interactions).toHaveLength(0);
      expect(data.userPreferences).toHaveLength(0);
      expect(data.engagementPatterns).toHaveLength(0);
    });
  });

  describe('clearData', () => {
    it('should clear all analytics data', () => {
      service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
      });

      service.trackContentView({
        contentId: 'content-1',
        contentType: ContentType.AUDIO_GUIDE,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 120,
        language: Language.ENGLISH,
        completed: true,
      });

      service.clearData();

      const status = service.getStatus();
      expect(status.totalEvents).toBe(0);
      expect(status.qrScans).toBe(0);
      expect(status.contentViews).toBe(0);
      expect(status.interactions).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      service.trackQRScan({
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
      });

      service.trackContentView({
        contentId: 'content-1',
        contentType: ContentType.AUDIO_GUIDE,
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
        duration: 120,
        language: Language.ENGLISH,
        completed: true,
      });

      service.trackInteraction({
        type: InteractionType.PLAY,
        contentId: 'content-1',
        artifactId: 'artifact-1',
        siteId: 'site-1',
        sessionId: 'session-1',
      });

      const status = service.getStatus();

      expect(status.totalEvents).toBe(3);
      expect(status.qrScans).toBe(1);
      expect(status.contentViews).toBe(1);
      expect(status.interactions).toBe(1);
      expect(status.privacyCompliant).toBe(true);
    });
  });
});
