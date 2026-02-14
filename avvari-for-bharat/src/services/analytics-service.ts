// Analytics Service for Data Collection and Storage
import { logger } from '../utils/logger';
import { Language, ContentType, InteractionType } from '../models/common';

export interface QRScanEvent {
  scanId: string;
  artifactId: string;
  siteId: string;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface ContentViewEvent {
  viewId: string;
  contentId: string;
  contentType: ContentType;
  artifactId: string;
  siteId: string;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  duration: number; // seconds
  language: Language;
  completed: boolean;
}

export interface InteractionEvent {
  interactionId: string;
  type: InteractionType;
  contentId: string;
  artifactId: string;
  siteId: string;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

export interface UserPreference {
  userId: string;
  preferredLanguage: Language;
  preferredContentTypes: ContentType[];
  accessibilitySettings: {
    audioDescriptions: boolean;
    highContrast: boolean;
    textSize: string;
  };
  lastUpdated: Date;
}

export interface EngagementPattern {
  userId?: string;
  sessionId: string;
  totalScans: number;
  totalViews: number;
  totalInteractions: number;
  averageViewDuration: number;
  mostViewedContentType: ContentType;
  mostVisitedSite: string;
  preferredLanguage: Language;
  sessionDuration: number;
  timestamp: Date;
}

export interface AnalyticsMetrics {
  totalQRScans: number;
  totalContentViews: number;
  totalInteractions: number;
  uniqueUsers: number;
  uniqueSessions: number;
  averageSessionDuration: number;
  popularArtifacts: Array<{ artifactId: string; count: number }>;
  popularSites: Array<{ siteId: string; count: number }>;
  contentTypeDistribution: Record<ContentType, number>;
  languageDistribution: Record<Language, number>;
}

export class AnalyticsService {
  private qrScans: Map<string, QRScanEvent>;
  private contentViews: Map<string, ContentViewEvent>;
  private interactions: Map<string, InteractionEvent>;
  private userPreferences: Map<string, UserPreference>;
  private engagementPatterns: Map<string, EngagementPattern>;
  private privacyCompliant: boolean;

  constructor(privacyCompliant: boolean = true) {
    this.qrScans = new Map();
    this.contentViews = new Map();
    this.interactions = new Map();
    this.userPreferences = new Map();
    this.engagementPatterns = new Map();
    this.privacyCompliant = privacyCompliant;

    logger.info('Analytics service initialized', {
      privacyCompliant: this.privacyCompliant,
    });
  }

  /**
   * Track QR code scan
   */
  public trackQRScan(event: Omit<QRScanEvent, 'scanId' | 'timestamp'>): string {
    const scanId = this.generateId('scan');
    const scanEvent: QRScanEvent = {
      ...event,
      scanId,
      timestamp: new Date(),
    };

    // Apply privacy compliance
    if (this.privacyCompliant && !event.userId) {
      // Don't store location data for anonymous users
      delete scanEvent.location;
    }

    this.qrScans.set(scanId, scanEvent);

    logger.info('QR scan tracked', {
      scanId,
      artifactId: event.artifactId,
      siteId: event.siteId,
    });

    return scanId;
  }

  /**
   * Track content view
   */
  public trackContentView(event: Omit<ContentViewEvent, 'viewId' | 'timestamp'>): string {
    const viewId = this.generateId('view');
    const viewEvent: ContentViewEvent = {
      ...event,
      viewId,
      timestamp: new Date(),
    };

    this.contentViews.set(viewId, viewEvent);

    logger.info('Content view tracked', {
      viewId,
      contentId: event.contentId,
      contentType: event.contentType,
      duration: event.duration,
    });

    return viewId;
  }

  /**
   * Track user interaction
   */
  public trackInteraction(event: Omit<InteractionEvent, 'interactionId' | 'timestamp'>): string {
    const interactionId = this.generateId('interaction');
    const interactionEvent: InteractionEvent = {
      ...event,
      interactionId,
      timestamp: new Date(),
    };

    this.interactions.set(interactionId, interactionEvent);

    logger.info('Interaction tracked', {
      interactionId,
      type: event.type,
      contentId: event.contentId,
    });

    return interactionId;
  }

  /**
   * Record user preference
   */
  public recordUserPreference(preference: Omit<UserPreference, 'lastUpdated'>): void {
    const userPreference: UserPreference = {
      ...preference,
      lastUpdated: new Date(),
    };

    this.userPreferences.set(preference.userId, userPreference);

    logger.info('User preference recorded', {
      userId: preference.userId,
      preferredLanguage: preference.preferredLanguage,
    });
  }

  /**
   * Get user preference
   */
  public getUserPreference(userId: string): UserPreference | null {
    return this.userPreferences.get(userId) || null;
  }

  /**
   * Record engagement pattern
   */
  public recordEngagementPattern(pattern: Omit<EngagementPattern, 'timestamp'>): void {
    const key = pattern.userId || pattern.sessionId;
    const engagementPattern: EngagementPattern = {
      ...pattern,
      timestamp: new Date(),
    };

    this.engagementPatterns.set(key, engagementPattern);

    logger.info('Engagement pattern recorded', {
      key,
      totalScans: pattern.totalScans,
      totalViews: pattern.totalViews,
    });
  }

  /**
   * Get engagement pattern
   */
  public getEngagementPattern(userIdOrSessionId: string): EngagementPattern | null {
    return this.engagementPatterns.get(userIdOrSessionId) || null;
  }

  /**
   * Get analytics metrics
   */
  public getMetrics(): AnalyticsMetrics {
    const uniqueUsers = new Set<string>();
    const uniqueSessions = new Set<string>();
    const artifactCounts = new Map<string, number>();
    const siteCounts = new Map<string, number>();
    const contentTypeCounts = new Map<ContentType, number>();
    const languageCounts = new Map<Language, number>();
    let totalSessionDuration = 0;

    // Process QR scans
    this.qrScans.forEach(scan => {
      if (scan.userId) uniqueUsers.add(scan.userId);
      uniqueSessions.add(scan.sessionId);

      artifactCounts.set(scan.artifactId, (artifactCounts.get(scan.artifactId) || 0) + 1);
      siteCounts.set(scan.siteId, (siteCounts.get(scan.siteId) || 0) + 1);
    });

    // Process content views
    this.contentViews.forEach(view => {
      if (view.userId) uniqueUsers.add(view.userId);
      uniqueSessions.add(view.sessionId);

      contentTypeCounts.set(view.contentType, (contentTypeCounts.get(view.contentType) || 0) + 1);
      languageCounts.set(view.language, (languageCounts.get(view.language) || 0) + 1);
    });

    // Process engagement patterns
    this.engagementPatterns.forEach(pattern => {
      totalSessionDuration += pattern.sessionDuration;
    });

    // Sort and get top artifacts and sites
    const popularArtifacts = Array.from(artifactCounts.entries())
      .map(([artifactId, count]) => ({ artifactId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const popularSites = Array.from(siteCounts.entries())
      .map(([siteId, count]) => ({ siteId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const metrics: AnalyticsMetrics = {
      totalQRScans: this.qrScans.size,
      totalContentViews: this.contentViews.size,
      totalInteractions: this.interactions.size,
      uniqueUsers: uniqueUsers.size,
      uniqueSessions: uniqueSessions.size,
      averageSessionDuration: this.engagementPatterns.size > 0 
        ? totalSessionDuration / this.engagementPatterns.size 
        : 0,
      popularArtifacts,
      popularSites,
      contentTypeDistribution: Object.fromEntries(contentTypeCounts) as Record<ContentType, number>,
      languageDistribution: Object.fromEntries(languageCounts) as Record<Language, number>,
    };

    logger.debug('Analytics metrics calculated', {
      totalQRScans: metrics.totalQRScans,
      totalContentViews: metrics.totalContentViews,
      uniqueUsers: metrics.uniqueUsers,
    });

    return metrics;
  }

  /**
   * Get QR scans by site
   */
  public getQRScansBySite(siteId: string): QRScanEvent[] {
    return Array.from(this.qrScans.values()).filter(scan => scan.siteId === siteId);
  }

  /**
   * Get content views by artifact
   */
  public getContentViewsByArtifact(artifactId: string): ContentViewEvent[] {
    return Array.from(this.contentViews.values()).filter(view => view.artifactId === artifactId);
  }

  /**
   * Get interactions by session
   */
  public getInteractionsBySession(sessionId: string): InteractionEvent[] {
    return Array.from(this.interactions.values()).filter(
      interaction => interaction.sessionId === sessionId
    );
  }

  /**
   * Get all user preferences
   */
  public getAllUserPreferences(): UserPreference[] {
    return Array.from(this.userPreferences.values());
  }

  /**
   * Get analytics summary for date range
   */
  public getAnalyticsSummary(startDate: Date, endDate: Date): {
    scans: number;
    views: number;
    interactions: number;
    uniqueSessions: number;
  } {
    const scans = Array.from(this.qrScans.values()).filter(
      scan => scan.timestamp >= startDate && scan.timestamp <= endDate
    );

    const views = Array.from(this.contentViews.values()).filter(
      view => view.timestamp >= startDate && view.timestamp <= endDate
    );

    const interactions = Array.from(this.interactions.values()).filter(
      interaction => interaction.timestamp >= startDate && interaction.timestamp <= endDate
    );

    const uniqueSessions = new Set([
      ...scans.map(s => s.sessionId),
      ...views.map(v => v.sessionId),
      ...interactions.map(i => i.sessionId),
    ]);

    return {
      scans: scans.length,
      views: views.length,
      interactions: interactions.length,
      uniqueSessions: uniqueSessions.size,
    };
  }

  /**
   * Export analytics data (privacy-compliant)
   */
  public exportData(): {
    qrScans: QRScanEvent[];
    contentViews: ContentViewEvent[];
    interactions: InteractionEvent[];
    userPreferences: UserPreference[];
    engagementPatterns: EngagementPattern[];
  } {
    logger.info('Exporting analytics data');

    return {
      qrScans: Array.from(this.qrScans.values()),
      contentViews: Array.from(this.contentViews.values()),
      interactions: Array.from(this.interactions.values()),
      userPreferences: Array.from(this.userPreferences.values()),
      engagementPatterns: Array.from(this.engagementPatterns.values()),
    };
  }

  /**
   * Clear all analytics data
   */
  public clearData(): void {
    this.qrScans.clear();
    this.contentViews.clear();
    this.interactions.clear();
    this.userPreferences.clear();
    this.engagementPatterns.clear();

    logger.info('Analytics data cleared');
  }

  /**
   * Get data collection status
   */
  public getStatus(): {
    totalEvents: number;
    qrScans: number;
    contentViews: number;
    interactions: number;
    userPreferences: number;
    engagementPatterns: number;
    privacyCompliant: boolean;
  } {
    return {
      totalEvents: this.qrScans.size + this.contentViews.size + this.interactions.size,
      qrScans: this.qrScans.size,
      contentViews: this.contentViews.size,
      interactions: this.interactions.size,
      userPreferences: this.userPreferences.size,
      engagementPatterns: this.engagementPatterns.size,
      privacyCompliant: this.privacyCompliant,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
