// User Sessions repository for DynamoDB operations
import { BaseRepository } from './base-repository';
import { UserSession, ValidationResult, Language, ContentInteraction, QAInteraction, InteractionType } from '../models/common';
import { validateUserSession } from '../utils/validation';
import { TABLES } from '../utils/aws-clients';
import { logger } from '../utils/logger';

export class UserSessionsRepository extends BaseRepository<UserSession> {
  constructor() {
    super(
      TABLES.USER_SESSIONS,
      {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
      },
      true, // Enable caching
      180000 // 3 minutes cache TTL for user sessions (shorter due to frequent updates)
    );
  }

  protected validateEntity(session: UserSession): ValidationResult {
    const result = validateUserSession(session);
    if (result.success) {
      return { isValid: true };
    }
    return { isValid: false, errors: result.errors };
  }

  protected getPrimaryKey(session: UserSession): Record<string, any> {
    return { sessionId: session.sessionId };
  }

  protected getCacheKey(key: Record<string, any>): string {
    return `user-session:${key.sessionId}`;
  }

  /**
   * Get user session by ID
   */
  public async getBySessionId(sessionId: string): Promise<UserSession | null> {
    logger.debug('Getting user session by ID', { sessionId });
    return await this.get({ sessionId });
  }

  /**
   * Create new user session
   */
  public async create(session: UserSession): Promise<void> {
    logger.info('Creating new user session', { 
      sessionId: session.sessionId, 
      siteId: session.siteId,
      language: session.preferredLanguage 
    });
    
    // Ensure timestamp is set
    session.visitStartTime = new Date().toISOString();
    
    await this.put(session, { overwrite: false });
  }

  /**
   * Update user session
   */
  public async updateSession(
    sessionId: string,
    updates: Partial<Omit<UserSession, 'sessionId' | 'visitStartTime'>>
  ): Promise<UserSession | null> {
    logger.debug('Updating user session', { sessionId, updates: Object.keys(updates) });
    
    return await this.update({ sessionId }, updates);
  }

  /**
   * Delete user session
   */
  public async deleteSession(sessionId: string): Promise<UserSession | null> {
    logger.info('Deleting user session', { sessionId });
    return await this.delete({ sessionId });
  }

  /**
   * Add scanned artifact to session
   */
  public async addScannedArtifact(sessionId: string, artifactId: string): Promise<UserSession | null> {
    logger.debug('Adding scanned artifact to session', { sessionId, artifactId });
    
    const currentSession = await this.getBySessionId(sessionId);
    if (!currentSession) {
      throw new Error(`User session not found: ${sessionId}`);
    }

    // Check if artifact is already scanned
    if (currentSession.scannedArtifacts.includes(artifactId)) {
      logger.debug('Artifact already scanned in session', { sessionId, artifactId });
      return currentSession;
    }

    const updatedArtifacts = [...currentSession.scannedArtifacts, artifactId];
    
    return await this.update(
      { sessionId },
      { scannedArtifacts: updatedArtifacts }
    );
  }

  /**
   * Add content interaction to session
   */
  public async addContentInteraction(
    sessionId: string,
    interaction: ContentInteraction
  ): Promise<UserSession | null> {
    logger.debug('Adding content interaction to session', { 
      sessionId, 
      contentId: interaction.contentId,
      interactionType: interaction.interactionType 
    });
    
    const currentSession = await this.getBySessionId(sessionId);
    if (!currentSession) {
      throw new Error(`User session not found: ${sessionId}`);
    }

    // Set timestamp if not provided
    if (!interaction.timestamp) {
      interaction.timestamp = new Date().toISOString();
    }

    const updatedInteractions = [...currentSession.contentInteractions, interaction];
    
    return await this.update(
      { sessionId },
      { contentInteractions: updatedInteractions }
    );
  }

  /**
   * Add Q&A interaction to session
   */
  public async addQAInteraction(
    sessionId: string,
    interaction: QAInteraction
  ): Promise<UserSession | null> {
    logger.debug('Adding Q&A interaction to session', { 
      sessionId, 
      question: interaction.question.substring(0, 50) + '...' 
    });
    
    const currentSession = await this.getBySessionId(sessionId);
    if (!currentSession) {
      throw new Error(`User session not found: ${sessionId}`);
    }

    // Set timestamp if not provided
    if (!interaction.timestamp) {
      interaction.timestamp = new Date().toISOString();
    }

    const updatedConversation = [...currentSession.conversationHistory, interaction];
    
    return await this.update(
      { sessionId },
      { conversationHistory: updatedConversation }
    );
  }

  /**
   * Update user preferences
   */
  public async updatePreferences(
    sessionId: string,
    preferences: Partial<UserSession['preferences']>
  ): Promise<UserSession | null> {
    logger.debug('Updating user preferences', { sessionId, preferences: Object.keys(preferences) });
    
    const currentSession = await this.getBySessionId(sessionId);
    if (!currentSession) {
      throw new Error(`User session not found: ${sessionId}`);
    }

    const updatedPreferences = {
      ...currentSession.preferences,
      ...preferences,
    };
    
    return await this.update(
      { sessionId },
      { preferences: updatedPreferences }
    );
  }

  /**
   * Get active sessions for a site
   */
  public async getActiveSessionsBySite(
    siteId: string,
    hoursAgo: number = 24
  ): Promise<UserSession[]> {
    logger.debug('Getting active sessions by site', { siteId, hoursAgo });
    
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    
    return await this.scan({
      FilterExpression: 'siteId = :siteId AND visitStartTime >= :cutoffTime',
      ExpressionAttributeValues: {
        ':siteId': siteId,
        ':cutoffTime': cutoffTime,
      },
    });
  }

  /**
   * Get sessions by language preference
   */
  public async getSessionsByLanguage(
    language: Language,
    hoursAgo: number = 24
  ): Promise<UserSession[]> {
    logger.debug('Getting sessions by language', { language, hoursAgo });
    
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    
    return await this.scan({
      FilterExpression: 'preferredLanguage = :language AND visitStartTime >= :cutoffTime',
      ExpressionAttributeValues: {
        ':language': language,
        ':cutoffTime': cutoffTime,
      },
    });
  }

  /**
   * Get sessions by user ID
   */
  public async getSessionsByUserId(userId: string): Promise<UserSession[]> {
    logger.debug('Getting sessions by user ID', { userId });
    
    return await this.scan({
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });
  }

  /**
   * Get session statistics for a site
   */
  public async getSessionStatistics(
    siteId: string,
    hoursAgo: number = 24
  ): Promise<{
    totalSessions: number;
    uniqueUsers: number;
    languageDistribution: Record<Language, number>;
    averageSessionDuration: number;
    totalArtifactScans: number;
    totalContentInteractions: number;
    totalQAInteractions: number;
    popularArtifacts: Array<{ artifactId: string; scanCount: number }>;
  }> {
    logger.debug('Getting session statistics', { siteId, hoursAgo });
    
    const sessions = await this.getActiveSessionsBySite(siteId, hoursAgo);
    
    const uniqueUsers = new Set<string>();
    const languageDistribution: Record<Language, number> = {} as Record<Language, number>;
    const artifactScans: Record<string, number> = {};
    let totalSessionDuration = 0;
    let totalContentInteractions = 0;
    let totalQAInteractions = 0;
    let totalArtifactScans = 0;
    
    const now = Date.now();
    
    for (const session of sessions) {
      // Unique users
      if (session.userId) {
        uniqueUsers.add(session.userId);
      }
      
      // Language distribution
      languageDistribution[session.preferredLanguage] = 
        (languageDistribution[session.preferredLanguage] || 0) + 1;
      
      // Session duration (estimate based on last interaction or current time)
      const startTime = new Date(session.visitStartTime).getTime();
      let endTime = now;
      
      // Find the latest interaction time
      const allInteractionTimes = [
        ...session.contentInteractions.map(i => new Date(i.timestamp).getTime()),
        ...session.conversationHistory.map(i => new Date(i.timestamp).getTime()),
      ];
      
      if (allInteractionTimes.length > 0) {
        endTime = Math.max(...allInteractionTimes);
      }
      
      totalSessionDuration += Math.max(0, endTime - startTime);
      
      // Artifact scans
      totalArtifactScans += session.scannedArtifacts.length;
      for (const artifactId of session.scannedArtifacts) {
        artifactScans[artifactId] = (artifactScans[artifactId] || 0) + 1;
      }
      
      // Content and Q&A interactions
      totalContentInteractions += session.contentInteractions.length;
      totalQAInteractions += session.conversationHistory.length;
    }
    
    // Calculate average session duration in minutes
    const averageSessionDuration = sessions.length > 0 
      ? totalSessionDuration / sessions.length / (1000 * 60) 
      : 0;
    
    // Get popular artifacts (top 10)
    const popularArtifacts = Object.entries(artifactScans)
      .map(([artifactId, scanCount]) => ({ artifactId, scanCount }))
      .sort((a, b) => b.scanCount - a.scanCount)
      .slice(0, 10);
    
    return {
      totalSessions: sessions.length,
      uniqueUsers: uniqueUsers.size,
      languageDistribution,
      averageSessionDuration,
      totalArtifactScans,
      totalContentInteractions,
      totalQAInteractions,
      popularArtifacts,
    };
  }

  /**
   * Get user engagement metrics
   */
  public async getUserEngagementMetrics(sessionId: string): Promise<{
    sessionDuration: number; // in minutes
    artifactsScanned: number;
    contentInteractions: number;
    qaInteractions: number;
    engagementScore: number; // 0-100
    interactionTypes: Record<InteractionType, number>;
  }> {
    logger.debug('Getting user engagement metrics', { sessionId });
    
    const session = await this.getBySessionId(sessionId);
    if (!session) {
      throw new Error(`User session not found: ${sessionId}`);
    }
    
    const startTime = new Date(session.visitStartTime).getTime();
    const now = Date.now();
    
    // Find the latest interaction time
    const allInteractionTimes = [
      ...session.contentInteractions.map(i => new Date(i.timestamp).getTime()),
      ...session.conversationHistory.map(i => new Date(i.timestamp).getTime()),
    ];
    
    const endTime = allInteractionTimes.length > 0 
      ? Math.max(...allInteractionTimes) 
      : now;
    
    const sessionDuration = Math.max(0, endTime - startTime) / (1000 * 60); // in minutes
    
    // Count interaction types
    const interactionTypes: Record<InteractionType, number> = {} as Record<InteractionType, number>;
    for (const interaction of session.contentInteractions) {
      interactionTypes[interaction.interactionType] = 
        (interactionTypes[interaction.interactionType] || 0) + 1;
    }
    
    // Calculate engagement score (0-100)
    // Based on: artifacts scanned, content interactions, Q&A interactions, session duration
    const artifactsScanned = session.scannedArtifacts.length;
    const contentInteractions = session.contentInteractions.length;
    const qaInteractions = session.conversationHistory.length;
    
    let engagementScore = 0;
    engagementScore += Math.min(artifactsScanned * 10, 30); // Max 30 points for artifacts
    engagementScore += Math.min(contentInteractions * 5, 25); // Max 25 points for content
    engagementScore += Math.min(qaInteractions * 8, 25); // Max 25 points for Q&A
    engagementScore += Math.min(sessionDuration * 2, 20); // Max 20 points for duration
    
    return {
      sessionDuration,
      artifactsScanned,
      contentInteractions,
      qaInteractions,
      engagementScore: Math.min(engagementScore, 100),
      interactionTypes,
    };
  }

  /**
   * Clean up old sessions
   */
  public async cleanupOldSessions(daysOld: number = 30): Promise<number> {
    logger.info('Cleaning up old sessions', { daysOld });
    
    const cutoffTime = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
    
    const oldSessions = await this.scan({
      FilterExpression: 'visitStartTime < :cutoffTime',
      ExpressionAttributeValues: {
        ':cutoffTime': cutoffTime,
      },
    });
    
    if (oldSessions.length === 0) {
      return 0;
    }
    
    // Delete in batches
    const batchSize = 25; // DynamoDB batch write limit
    let deletedCount = 0;
    
    for (let i = 0; i < oldSessions.length; i += batchSize) {
      const batch = oldSessions.slice(i, i + batchSize);
      const deleteKeys = batch.map(session => ({ sessionId: session.sessionId }));
      
      await this.batchWrite([], deleteKeys);
      deletedCount += batch.length;
    }
    
    logger.info('Cleaned up old sessions', { deletedCount });
    return deletedCount;
  }

  /**
   * Get sessions with pagination
   */
  public async getSessionsWithPagination(
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    sessions: UserSession[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    logger.debug('Getting sessions with pagination', { limit, hasLastKey: !!lastEvaluatedKey });
    
    const result = await this.executeWithRetry(
      async () => {
        const command = new (await import('@aws-sdk/lib-dynamodb')).ScanCommand({
          TableName: this.tableName,
          Limit: limit,
          ExclusiveStartKey: lastEvaluatedKey,
        });
        return await (await import('../utils/aws-clients')).docClient.send(command);
      },
      'getSessionsWithPagination',
      { limit }
    );

    return {
      sessions: (result.Items as UserSession[]) || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Get cache statistics specific to user sessions
   */
  public getUserSessionCacheStats(): { size: number; hitRate?: number } {
    return this.getCacheStats();
  }
}