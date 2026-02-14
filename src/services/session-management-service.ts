// Session Management Service
import { UserSession, UserPreferences, Language, ContentInteraction, QAInteraction } from '../models/common';
import { RepositoryFactory } from '../repositories';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface SessionCreationOptions {
  userId?: string;
  siteId: string;
  preferredLanguage: Language;
  preferences?: Partial<UserPreferences>;
}

export interface SessionUpdateOptions {
  preferredLanguage?: Language;
  preferences?: Partial<UserPreferences>;
}

export class SessionManagementService {
  private userSessionsRepository = RepositoryFactory.getUserSessionsRepository();
  private readonly SESSION_TIMEOUT_HOURS = 24;
  private readonly CLEANUP_INTERVAL_DAYS = 30;

  /**
   * Create a new user session
   */
  public async createSession(options: SessionCreationOptions): Promise<UserSession> {
    logger.info('Creating new user session', {
      userId: options.userId,
      siteId: options.siteId,
      language: options.preferredLanguage,
    });

    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const defaultPreferences: UserPreferences = {
      language: options.preferredLanguage,
      audioSpeed: 1.0,
      volume: 0.8,
      highContrast: false,
      largeText: false,
      audioDescriptions: false,
    };

    const session: UserSession = {
      sessionId,
      userId: options.userId,
      siteId: options.siteId,
      preferredLanguage: options.preferredLanguage,
      visitStartTime: now,
      scannedArtifacts: [],
      contentInteractions: [],
      conversationHistory: [],
      preferences: {
        ...defaultPreferences,
        ...options.preferences,
      },
    };

    await this.userSessionsRepository.create(session);

    logger.info('User session created successfully', { sessionId, siteId: options.siteId });
    return session;
  }

  /**
   * Get session by ID
   */
  public async getSession(sessionId: string): Promise<UserSession | null> {
    logger.debug('Getting user session', { sessionId });

    const session = await this.userSessionsRepository.getBySessionId(sessionId);

    if (!session) {
      logger.warn('Session not found', { sessionId });
      return null;
    }

    // Check if session has expired
    if (this.isSessionExpired(session)) {
      logger.info('Session has expired', { sessionId });
      await this.userSessionsRepository.deleteSession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update session
   */
  public async updateSession(
    sessionId: string,
    updates: SessionUpdateOptions
  ): Promise<UserSession | null> {
    logger.debug('Updating user session', { sessionId, updates: Object.keys(updates) });

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Merge preferences if provided
    const repositoryUpdates: Partial<Omit<UserSession, 'sessionId' | 'visitStartTime'>> = {
      ...updates,
      preferences: updates.preferences 
        ? { ...session.preferences, ...updates.preferences }
        : undefined,
    };

    return await this.userSessionsRepository.updateSession(sessionId, repositoryUpdates);
  }

  /**
   * Add scanned artifact to session
   */
  public async addScannedArtifact(
    sessionId: string,
    artifactId: string
  ): Promise<UserSession | null> {
    logger.debug('Adding scanned artifact to session', { sessionId, artifactId });

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return await this.userSessionsRepository.addScannedArtifact(sessionId, artifactId);
  }

  /**
   * Add content interaction to session
   */
  public async addContentInteraction(
    sessionId: string,
    interaction: Omit<ContentInteraction, 'timestamp'>
  ): Promise<UserSession | null> {
    logger.debug('Adding content interaction to session', {
      sessionId,
      contentId: interaction.contentId,
      interactionType: interaction.interactionType,
    });

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const fullInteraction: ContentInteraction = {
      ...interaction,
      timestamp: new Date().toISOString(),
    };

    return await this.userSessionsRepository.addContentInteraction(sessionId, fullInteraction);
  }

  /**
   * Add Q&A interaction to session
   */
  public async addQAInteraction(
    sessionId: string,
    interaction: Omit<QAInteraction, 'timestamp'>
  ): Promise<UserSession | null> {
    logger.debug('Adding Q&A interaction to session', {
      sessionId,
      question: interaction.question.substring(0, 50) + '...',
    });

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const fullInteraction: QAInteraction = {
      ...interaction,
      timestamp: new Date().toISOString(),
    };

    return await this.userSessionsRepository.addQAInteraction(sessionId, fullInteraction);
  }

  /**
   * Update user preferences
   */
  public async updatePreferences(
    sessionId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserSession | null> {
    logger.debug('Updating user preferences', { sessionId, preferences: Object.keys(preferences) });

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return await this.userSessionsRepository.updatePreferences(sessionId, preferences);
  }

  /**
   * Get session history for a user
   */
  public async getUserSessionHistory(userId: string): Promise<UserSession[]> {
    logger.debug('Getting user session history', { userId });

    const sessions = await this.userSessionsRepository.getSessionsByUserId(userId);

    // Filter out expired sessions
    return sessions.filter((session: UserSession) => !this.isSessionExpired(session));
  }

  /**
   * Get active sessions for a site
   */
  public async getActiveSessions(siteId: string, hoursAgo: number = 24): Promise<UserSession[]> {
    logger.debug('Getting active sessions for site', { siteId, hoursAgo });

    const sessions = await this.userSessionsRepository.getActiveSessionsBySite(siteId, hoursAgo);

    // Filter out expired sessions
    return sessions.filter((session: UserSession) => !this.isSessionExpired(session));
  }

  /**
   * Get session statistics
   */
  public async getSessionStatistics(siteId: string, hoursAgo: number = 24) {
    logger.debug('Getting session statistics', { siteId, hoursAgo });

    return await this.userSessionsRepository.getSessionStatistics(siteId, hoursAgo);
  }

  /**
   * Get user engagement metrics
   */
  public async getUserEngagementMetrics(sessionId: string) {
    logger.debug('Getting user engagement metrics', { sessionId });

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return await this.userSessionsRepository.getUserEngagementMetrics(sessionId);
  }

  /**
   * End session (soft delete - mark as ended)
   */
  public async endSession(sessionId: string): Promise<void> {
    logger.info('Ending user session', { sessionId });

    const session = await this.getSession(sessionId);
    if (!session) {
      logger.warn('Cannot end session - not found', { sessionId });
      return;
    }

    // In a real implementation, you might want to mark the session as ended
    // rather than deleting it immediately for analytics purposes
    // For now, we'll just log it
    logger.info('Session ended', {
      sessionId,
      duration: this.getSessionDuration(session),
      artifactsScanned: session.scannedArtifacts.length,
      interactions: session.contentInteractions.length + session.conversationHistory.length,
    });
  }

  /**
   * Delete session
   */
  public async deleteSession(sessionId: string): Promise<void> {
    logger.info('Deleting user session', { sessionId });

    await this.userSessionsRepository.deleteSession(sessionId);
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(session: UserSession): boolean {
    const now = Date.now();
    const sessionStart = new Date(session.visitStartTime).getTime();
    const sessionAge = now - sessionStart;
    const maxAge = this.SESSION_TIMEOUT_HOURS * 60 * 60 * 1000;

    return sessionAge > maxAge;
  }

  /**
   * Get session duration in minutes
   */
  private getSessionDuration(session: UserSession): number {
    const now = Date.now();
    const sessionStart = new Date(session.visitStartTime).getTime();

    // Find the latest interaction time
    const allInteractionTimes = [
      ...session.contentInteractions.map(i => new Date(i.timestamp).getTime()),
      ...session.conversationHistory.map(i => new Date(i.timestamp).getTime()),
    ];

    const endTime = allInteractionTimes.length > 0 ? Math.max(...allInteractionTimes) : now;

    return Math.max(0, endTime - sessionStart) / (1000 * 60); // in minutes
  }

  /**
   * Cleanup expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    logger.info('Cleaning up expired sessions');

    return await this.userSessionsRepository.cleanupOldSessions(this.CLEANUP_INTERVAL_DAYS);
  }

  /**
   * Get conversation context for Q&A
   */
  public async getConversationContext(sessionId: string, maxMessages: number = 10): Promise<QAInteraction[]> {
    logger.debug('Getting conversation context', { sessionId, maxMessages });

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Return the most recent Q&A interactions
    return session.conversationHistory.slice(-maxMessages);
  }

  /**
   * Get scanned artifacts for session
   */
  public async getScannedArtifacts(sessionId: string): Promise<string[]> {
    logger.debug('Getting scanned artifacts', { sessionId });

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session.scannedArtifacts;
  }

  /**
   * Check if artifact has been scanned in session
   */
  public async hasScannedArtifact(sessionId: string, artifactId: string): Promise<boolean> {
    logger.debug('Checking if artifact has been scanned', { sessionId, artifactId });

    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    return session.scannedArtifacts.includes(artifactId);
  }

  /**
   * Get session summary
   */
  public async getSessionSummary(sessionId: string): Promise<{
    sessionId: string;
    siteId: string;
    duration: number;
    artifactsScanned: number;
    contentInteractions: number;
    qaInteractions: number;
    preferredLanguage: Language;
    isActive: boolean;
  }> {
    logger.debug('Getting session summary', { sessionId });

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return {
      sessionId: session.sessionId,
      siteId: session.siteId,
      duration: this.getSessionDuration(session),
      artifactsScanned: session.scannedArtifacts.length,
      contentInteractions: session.contentInteractions.length,
      qaInteractions: session.conversationHistory.length,
      preferredLanguage: session.preferredLanguage,
      isActive: !this.isSessionExpired(session),
    };
  }

  /**
   * Validate session exists and is active
   */
  public async validateSession(sessionId: string): Promise<{
    isValid: boolean;
    session?: UserSession;
    error?: string;
  }> {
    logger.debug('Validating session', { sessionId });

    if (!sessionId || sessionId.trim().length === 0) {
      return { isValid: false, error: 'Session ID is required' };
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      return { isValid: false, error: 'Session not found or expired' };
    }

    return { isValid: true, session };
  }
}
