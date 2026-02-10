// Unit tests for SessionManagementService
import { SessionManagementService } from '../../src/services/session-management-service';
import { RepositoryFactory } from '../../src/repositories';
import { Language, InteractionType } from '../../src/models/common';

// Mock repositories
jest.mock('../../src/repositories');
jest.mock('../../src/utils/logger');

describe('SessionManagementService', () => {
  let service: SessionManagementService;
  let mockUserSessionsRepo: any;

  const mockSession = {
    sessionId: 'session-1',
    userId: 'user-1',
    siteId: 'site-1',
    preferredLanguage: Language.ENGLISH,
    visitStartTime: new Date().toISOString(),
    scannedArtifacts: [],
    contentInteractions: [],
    conversationHistory: [],
    preferences: {
      language: Language.ENGLISH,
      audioSpeed: 1.0,
      volume: 0.8,
      highContrast: false,
      largeText: false,
      audioDescriptions: false,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUserSessionsRepo = {
      create: jest.fn(),
      getBySessionId: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      addScannedArtifact: jest.fn(),
      addContentInteraction: jest.fn(),
      addQAInteraction: jest.fn(),
      updatePreferences: jest.fn(),
      getSessionsByUserId: jest.fn(),
      getActiveSessionsBySite: jest.fn(),
      getSessionStatistics: jest.fn(),
      getUserEngagementMetrics: jest.fn(),
      cleanupOldSessions: jest.fn(),
    };
    
    (RepositoryFactory.getUserSessionsRepository as jest.Mock).mockReturnValue(mockUserSessionsRepo);
    
    service = new SessionManagementService();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      mockUserSessionsRepo.create.mockResolvedValue(undefined);

      const result = await service.createSession({
        userId: 'user-1',
        siteId: 'site-1',
        preferredLanguage: Language.ENGLISH,
      });

      expect(result.sessionId).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(result.siteId).toBe('site-1');
      expect(result.preferredLanguage).toBe(Language.ENGLISH);
      expect(result.scannedArtifacts).toEqual([]);
      expect(result.contentInteractions).toEqual([]);
      expect(result.conversationHistory).toEqual([]);
      expect(mockUserSessionsRepo.create).toHaveBeenCalled();
    });

    it('should create session with custom preferences', async () => {
      mockUserSessionsRepo.create.mockResolvedValue(undefined);

      const result = await service.createSession({
        siteId: 'site-1',
        preferredLanguage: Language.HINDI,
        preferences: {
          audioSpeed: 1.5,
          volume: 0.5,
          highContrast: true,
        },
      });

      expect(result.preferences.audioSpeed).toBe(1.5);
      expect(result.preferences.volume).toBe(0.5);
      expect(result.preferences.highContrast).toBe(true);
    });

    it('should create session without user ID', async () => {
      mockUserSessionsRepo.create.mockResolvedValue(undefined);

      const result = await service.createSession({
        siteId: 'site-1',
        preferredLanguage: Language.ENGLISH,
      });

      expect(result.userId).toBeUndefined();
      expect(result.sessionId).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should get existing session', async () => {
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(mockSession);

      const result = await service.getSession('session-1');

      expect(result).toEqual(mockSession);
      expect(mockUserSessionsRepo.getBySessionId).toHaveBeenCalledWith('session-1');
    });

    it('should return null for non-existent session', async () => {
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(null);

      const result = await service.getSession('nonexistent');

      expect(result).toBeNull();
    });

    it('should delete expired session', async () => {
      const expiredSession = {
        ...mockSession,
        visitStartTime: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
      };
      
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(expiredSession);
      mockUserSessionsRepo.deleteSession.mockResolvedValue(expiredSession);

      const result = await service.getSession('session-1');

      expect(result).toBeNull();
      expect(mockUserSessionsRepo.deleteSession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('updateSession', () => {
    it('should update session', async () => {
      const updatedSession = { ...mockSession, preferredLanguage: Language.HINDI };
      
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(mockSession);
      mockUserSessionsRepo.updateSession.mockResolvedValue(updatedSession);

      const result = await service.updateSession('session-1', {
        preferredLanguage: Language.HINDI,
      });

      expect(result?.preferredLanguage).toBe(Language.HINDI);
      expect(mockUserSessionsRepo.updateSession).toHaveBeenCalled();
    });

    it('should throw error for non-existent session', async () => {
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(null);

      await expect(
        service.updateSession('nonexistent', { preferredLanguage: Language.HINDI })
      ).rejects.toThrow('Session not found: nonexistent');
    });
  });

  describe('addScannedArtifact', () => {
    it('should add scanned artifact', async () => {
      const updatedSession = {
        ...mockSession,
        scannedArtifacts: ['artifact-1'],
      };
      
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(mockSession);
      mockUserSessionsRepo.addScannedArtifact.mockResolvedValue(updatedSession);

      const result = await service.addScannedArtifact('session-1', 'artifact-1');

      expect(result?.scannedArtifacts).toContain('artifact-1');
      expect(mockUserSessionsRepo.addScannedArtifact).toHaveBeenCalledWith('session-1', 'artifact-1');
    });

    it('should throw error for non-existent session', async () => {
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(null);

      await expect(
        service.addScannedArtifact('nonexistent', 'artifact-1')
      ).rejects.toThrow('Session not found: nonexistent');
    });
  });

  describe('addContentInteraction', () => {
    it('should add content interaction', async () => {
      const interaction = {
        contentId: 'content-1',
        interactionType: InteractionType.VIEW,
      };
      
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(mockSession);
      mockUserSessionsRepo.addContentInteraction.mockResolvedValue({
        ...mockSession,
        contentInteractions: [{ ...interaction, timestamp: new Date().toISOString() }],
      });

      const result = await service.addContentInteraction('session-1', interaction);

      expect(result?.contentInteractions).toHaveLength(1);
      expect(mockUserSessionsRepo.addContentInteraction).toHaveBeenCalled();
    });
  });

  describe('addQAInteraction', () => {
    it('should add Q&A interaction', async () => {
      const interaction = {
        id: 'qa-1',
        question: 'What is this artifact?',
        answer: 'This is a pillar.',
        language: Language.ENGLISH,
        confidence: 0.95,
        sources: [],
      };
      
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(mockSession);
      mockUserSessionsRepo.addQAInteraction.mockResolvedValue({
        ...mockSession,
        conversationHistory: [{ ...interaction, timestamp: new Date().toISOString() }],
      });

      const result = await service.addQAInteraction('session-1', interaction);

      expect(result?.conversationHistory).toHaveLength(1);
      expect(mockUserSessionsRepo.addQAInteraction).toHaveBeenCalled();
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      const updatedSession = {
        ...mockSession,
        preferences: { ...mockSession.preferences, audioSpeed: 1.5 },
      };
      
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(mockSession);
      mockUserSessionsRepo.updatePreferences.mockResolvedValue(updatedSession);

      const result = await service.updatePreferences('session-1', { audioSpeed: 1.5 });

      expect(result?.preferences.audioSpeed).toBe(1.5);
      expect(mockUserSessionsRepo.updatePreferences).toHaveBeenCalled();
    });
  });

  describe('getUserSessionHistory', () => {
    it('should get user session history', async () => {
      const sessions = [mockSession];
      mockUserSessionsRepo.getSessionsByUserId.mockResolvedValue(sessions);

      const result = await service.getUserSessionHistory('user-1');

      expect(result).toEqual(sessions);
      expect(mockUserSessionsRepo.getSessionsByUserId).toHaveBeenCalledWith('user-1');
    });

    it('should filter out expired sessions', async () => {
      const expiredSession = {
        ...mockSession,
        sessionId: 'expired',
        visitStartTime: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      };
      
      mockUserSessionsRepo.getSessionsByUserId.mockResolvedValue([mockSession, expiredSession]);

      const result = await service.getUserSessionHistory('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe('session-1');
    });
  });

  describe('getActiveSessions', () => {
    it('should get active sessions for site', async () => {
      const sessions = [mockSession];
      mockUserSessionsRepo.getActiveSessionsBySite.mockResolvedValue(sessions);

      const result = await service.getActiveSessions('site-1', 24);

      expect(result).toEqual(sessions);
      expect(mockUserSessionsRepo.getActiveSessionsBySite).toHaveBeenCalledWith('site-1', 24);
    });
  });

  describe('getSessionStatistics', () => {
    it('should get session statistics', async () => {
      const stats = {
        totalSessions: 10,
        uniqueUsers: 8,
        languageDistribution: { [Language.ENGLISH]: 6, [Language.HINDI]: 4 },
        averageSessionDuration: 15.5,
        totalArtifactScans: 25,
        totalContentInteractions: 40,
        totalQAInteractions: 15,
        popularArtifacts: [],
      };
      
      mockUserSessionsRepo.getSessionStatistics.mockResolvedValue(stats);

      const result = await service.getSessionStatistics('site-1', 24);

      expect(result).toEqual(stats);
      expect(mockUserSessionsRepo.getSessionStatistics).toHaveBeenCalledWith('site-1', 24);
    });
  });

  describe('getUserEngagementMetrics', () => {
    it('should get user engagement metrics', async () => {
      const metrics = {
        sessionDuration: 15.5,
        artifactsScanned: 3,
        contentInteractions: 5,
        qaInteractions: 2,
        engagementScore: 75,
        interactionTypes: { [InteractionType.VIEW]: 3, [InteractionType.PLAY]: 2 },
      };
      
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(mockSession);
      mockUserSessionsRepo.getUserEngagementMetrics.mockResolvedValue(metrics);

      const result = await service.getUserEngagementMetrics('session-1');

      expect(result).toEqual(metrics);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', async () => {
      mockUserSessionsRepo.cleanupOldSessions.mockResolvedValue(5);

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(5);
      expect(mockUserSessionsRepo.cleanupOldSessions).toHaveBeenCalled();
    });
  });

  describe('getConversationContext', () => {
    it('should get conversation context', async () => {
      const sessionWithHistory = {
        ...mockSession,
        conversationHistory: [
          {
            id: 'qa-1',
            question: 'Question 1',
            answer: 'Answer 1',
            timestamp: new Date().toISOString(),
            language: Language.ENGLISH,
            confidence: 0.9,
            sources: [],
          },
          {
            id: 'qa-2',
            question: 'Question 2',
            answer: 'Answer 2',
            timestamp: new Date().toISOString(),
            language: Language.ENGLISH,
            confidence: 0.95,
            sources: [],
          },
        ],
      };
      
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(sessionWithHistory);

      const result = await service.getConversationContext('session-1', 10);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('qa-1');
    });

    it('should limit conversation context', async () => {
      const sessionWithHistory = {
        ...mockSession,
        conversationHistory: Array.from({ length: 15 }, (_, i) => ({
          id: `qa-${i}`,
          question: `Question ${i}`,
          answer: `Answer ${i}`,
          timestamp: new Date().toISOString(),
          language: Language.ENGLISH,
          confidence: 0.9,
          sources: [],
        })),
      };
      
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(sessionWithHistory);

      const result = await service.getConversationContext('session-1', 5);

      expect(result).toHaveLength(5);
      expect(result[0].id).toBe('qa-10'); // Last 5 messages
    });
  });

  describe('hasScannedArtifact', () => {
    it('should return true if artifact was scanned', async () => {
      const sessionWithArtifacts = {
        ...mockSession,
        scannedArtifacts: ['artifact-1', 'artifact-2'],
      };
      
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(sessionWithArtifacts);

      const result = await service.hasScannedArtifact('session-1', 'artifact-1');

      expect(result).toBe(true);
    });

    it('should return false if artifact was not scanned', async () => {
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(mockSession);

      const result = await service.hasScannedArtifact('session-1', 'artifact-1');

      expect(result).toBe(false);
    });

    it('should return false for non-existent session', async () => {
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(null);

      const result = await service.hasScannedArtifact('nonexistent', 'artifact-1');

      expect(result).toBe(false);
    });
  });

  describe('getSessionSummary', () => {
    it('should get session summary', async () => {
      const sessionWithData = {
        ...mockSession,
        scannedArtifacts: ['artifact-1', 'artifact-2'],
        contentInteractions: [
          {
            contentId: 'content-1',
            interactionType: InteractionType.VIEW,
            timestamp: new Date().toISOString(),
          },
        ],
        conversationHistory: [
          {
            id: 'qa-1',
            question: 'Question',
            answer: 'Answer',
            timestamp: new Date().toISOString(),
            language: Language.ENGLISH,
            confidence: 0.9,
            sources: [],
          },
        ],
      };
      
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(sessionWithData);

      const result = await service.getSessionSummary('session-1');

      expect(result.sessionId).toBe('session-1');
      expect(result.siteId).toBe('site-1');
      expect(result.artifactsScanned).toBe(2);
      expect(result.contentInteractions).toBe(1);
      expect(result.qaInteractions).toBe(1);
      expect(result.isActive).toBe(true);
    });
  });

  describe('validateSession', () => {
    it('should validate existing session', async () => {
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(mockSession);

      const result = await service.validateSession('session-1');

      expect(result.isValid).toBe(true);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty session ID', async () => {
      const result = await service.validateSession('');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Session ID is required');
    });

    it('should reject non-existent session', async () => {
      mockUserSessionsRepo.getBySessionId.mockResolvedValue(null);

      const result = await service.validateSession('nonexistent');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Session not found or expired');
    });
  });
});
