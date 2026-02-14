// Property-Based Tests for Session Management
// Feature: avvari-for-bharat
import * as fc from 'fast-check';
import { SessionManagementService } from '../../src/services/session-management-service';
import { Language, InteractionType, UserSession } from '../../src/models/common';
import { RepositoryFactory } from '../../src/repositories';

// Mock the repository factory
jest.mock('../../src/repositories', () => ({
  RepositoryFactory: {
    getUserSessionsRepository: jest.fn(),
  },
}));

describe('Session Management - Property-Based Tests', () => {
  let sessionService: SessionManagementService;
  let mockRepository: any;
  let sessionStore: Map<string, UserSession>;

  beforeEach(() => {
    // Reset session store
    sessionStore = new Map();

    // Create mock repository
    mockRepository = {
      create: jest.fn(async (session: UserSession) => {
        sessionStore.set(session.sessionId, { ...session });
      }),
      getBySessionId: jest.fn(async (sessionId: string) => {
        const session = sessionStore.get(sessionId);
        return session ? { ...session } : null;
      }),
      updateSession: jest.fn(async (sessionId: string, updates: Partial<UserSession>) => {
        const session = sessionStore.get(sessionId);
        if (!session) return null;
        const updated = { ...session, ...updates };
        sessionStore.set(sessionId, updated);
        return updated;
      }),
      addScannedArtifact: jest.fn(async (sessionId: string, artifactId: string) => {
        const session = sessionStore.get(sessionId);
        if (!session) return null;
        session.scannedArtifacts.push(artifactId);
        sessionStore.set(sessionId, session);
        return session;
      }),
      addContentInteraction: jest.fn(async (sessionId: string, interaction: any) => {
        const session = sessionStore.get(sessionId);
        if (!session) return null;
        session.contentInteractions.push(interaction);
        sessionStore.set(sessionId, session);
        return session;
      }),
      deleteSession: jest.fn(async (sessionId: string) => {
        const session = sessionStore.get(sessionId);
        sessionStore.delete(sessionId);
        return session || null;
      }),
    };

    // Mock the factory to return our mock repository
    (RepositoryFactory.getUserSessionsRepository as jest.Mock).mockReturnValue(mockRepository);

    // Create service instance
    sessionService = new SessionManagementService();
  });

  /**
   * Property 4: Session State Consistency
   * Validates: Requirements 1.4
   * 
   * For any sequence of QR code scans within a user session, all scanned artifacts
   * should be maintained in the session history and remain accessible throughout the session
   */
  describe('Property 4: Session State Consistency', () => {
    it('should maintain all scanned artifacts in session history', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate site ID
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          // Generate language
          fc.constantFrom(
            Language.ENGLISH, Language.HINDI, Language.TAMIL, Language.TELUGU,
            Language.BENGALI, Language.MARATHI, Language.GUJARATI, Language.KANNADA,
            Language.MALAYALAM, Language.PUNJABI
          ),
          // Generate array of artifact IDs (sequence of scans)
          fc.array(
            fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
            { minLength: 1, maxLength: 10 }
          ),
          async (siteId, language, artifactIds) => {
            // Create a session
            const session = await sessionService.createSession({
              siteId,
              preferredLanguage: language,
            });

            // Scan multiple artifacts in sequence
            for (const artifactId of artifactIds) {
              await sessionService.addScannedArtifact(session.sessionId, artifactId);
            }

            // Retrieve the session
            const retrievedSession = await sessionService.getSession(session.sessionId);

            // Property: All scanned artifacts should be in the session history
            expect(retrievedSession).not.toBeNull();
            expect(retrievedSession!.scannedArtifacts).toHaveLength(artifactIds.length);
            
            // All artifacts should be present
            for (const artifactId of artifactIds) {
              expect(retrievedSession!.scannedArtifacts).toContain(artifactId);
            }

            // Cleanup
            await sessionService.deleteSession(session.sessionId);
          }
        ),
        { numRuns: 50 } // Reduced runs for async tests
      );
    });

    it('should maintain session state across multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.constantFrom(
            Language.ENGLISH, Language.HINDI, Language.TAMIL, Language.TELUGU,
            Language.BENGALI, Language.MARATHI, Language.GUJARATI, Language.KANNADA,
            Language.MALAYALAM, Language.PUNJABI
          ),
          fc.array(
            fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
            { minLength: 1, maxLength: 5 }
          ),
          async (siteId, language, artifactIds) => {
            // Create session
            const session = await sessionService.createSession({
              siteId,
              preferredLanguage: language,
            });

            // Add artifacts
            for (const artifactId of artifactIds) {
              await sessionService.addScannedArtifact(session.sessionId, artifactId);
            }

            // Add content interactions
            for (let i = 0; i < artifactIds.length; i++) {
              await sessionService.addContentInteraction(session.sessionId, {
                contentId: `content-${artifactIds[i]}`,
                interactionType: InteractionType.VIEW,
                duration: 30,
                completionPercentage: 100,
              });
            }

            // Retrieve session
            const retrievedSession = await sessionService.getSession(session.sessionId);

            // Property: Session should maintain all state
            expect(retrievedSession).not.toBeNull();
            expect(retrievedSession!.scannedArtifacts).toHaveLength(artifactIds.length);
            expect(retrievedSession!.contentInteractions).toHaveLength(artifactIds.length);
            expect(retrievedSession!.siteId).toBe(siteId);
            expect(retrievedSession!.preferredLanguage).toBe(language);

            // Cleanup
            await sessionService.deleteSession(session.sessionId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve scan order in session history', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.constantFrom(
            Language.ENGLISH, Language.HINDI, Language.TAMIL, Language.TELUGU,
            Language.BENGALI, Language.MARATHI, Language.GUJARATI, Language.KANNADA,
            Language.MALAYALAM, Language.PUNJABI
          ),
          fc.array(
            fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
            { minLength: 2, maxLength: 5 }
          ).filter(arr => new Set(arr).size === arr.length), // Ensure unique artifacts
          async (siteId, language, artifactIds) => {
            // Create session
            const session = await sessionService.createSession({
              siteId,
              preferredLanguage: language,
            });

            // Scan artifacts in specific order
            for (const artifactId of artifactIds) {
              await sessionService.addScannedArtifact(session.sessionId, artifactId);
            }

            // Retrieve session
            const retrievedSession = await sessionService.getSession(session.sessionId);

            // Property: Scan order should be preserved
            expect(retrievedSession).not.toBeNull();
            expect(retrievedSession!.scannedArtifacts).toEqual(artifactIds);

            // Cleanup
            await sessionService.deleteSession(session.sessionId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should allow checking if artifact was scanned', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.constantFrom(
            Language.ENGLISH, Language.HINDI, Language.TAMIL, Language.TELUGU,
            Language.BENGALI, Language.MARATHI, Language.GUJARATI, Language.KANNADA,
            Language.MALAYALAM, Language.PUNJABI
          ),
          fc.array(
            fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
            { minLength: 1, maxLength: 5 }
          ),
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          async (siteId, language, scannedArtifacts, unscannedArtifact) => {
            // Ensure unscanned artifact is not in the scanned list
            if (scannedArtifacts.includes(unscannedArtifact)) {
              return; // Skip this test case
            }

            // Create session
            const session = await sessionService.createSession({
              siteId,
              preferredLanguage: language,
            });

            // Scan artifacts
            for (const artifactId of scannedArtifacts) {
              await sessionService.addScannedArtifact(session.sessionId, artifactId);
            }

            // Property: Should correctly identify scanned vs unscanned artifacts
            for (const artifactId of scannedArtifacts) {
              const hasScanned = await sessionService.hasScannedArtifact(session.sessionId, artifactId);
              expect(hasScanned).toBe(true);
            }

            const hasUnscanned = await sessionService.hasScannedArtifact(session.sessionId, unscannedArtifact);
            expect(hasUnscanned).toBe(false);

            // Cleanup
            await sessionService.deleteSession(session.sessionId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain session summary consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.constantFrom(
            Language.ENGLISH, Language.HINDI, Language.TAMIL, Language.TELUGU,
            Language.BENGALI, Language.MARATHI, Language.GUJARATI, Language.KANNADA,
            Language.MALAYALAM, Language.PUNJABI
          ),
          fc.array(
            fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
            { minLength: 1, maxLength: 5 }
          ),
          async (siteId, language, artifactIds) => {
            // Create session
            const session = await sessionService.createSession({
              siteId,
              preferredLanguage: language,
            });

            // Add artifacts and interactions
            for (const artifactId of artifactIds) {
              await sessionService.addScannedArtifact(session.sessionId, artifactId);
              await sessionService.addContentInteraction(session.sessionId, {
                contentId: `content-${artifactId}`,
                interactionType: InteractionType.VIEW,
              });
            }

            // Get summary
            const summary = await sessionService.getSessionSummary(session.sessionId);

            // Property: Summary should reflect actual session state
            expect(summary.sessionId).toBe(session.sessionId);
            expect(summary.siteId).toBe(siteId);
            expect(summary.preferredLanguage).toBe(language);
            expect(summary.artifactsScanned).toBe(artifactIds.length);
            expect(summary.contentInteractions).toBe(artifactIds.length);
            expect(summary.isActive).toBe(true);

            // Cleanup
            await sessionService.deleteSession(session.sessionId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle duplicate artifact scans correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.constantFrom(
            Language.ENGLISH, Language.HINDI, Language.TAMIL, Language.TELUGU,
            Language.BENGALI, Language.MARATHI, Language.GUJARATI, Language.KANNADA,
            Language.MALAYALAM, Language.PUNJABI
          ),
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.integer({ min: 2, max: 5 }),
          async (siteId, language, artifactId, scanCount) => {
            // Create session
            const session = await sessionService.createSession({
              siteId,
              preferredLanguage: language,
            });

            // Scan the same artifact multiple times
            for (let i = 0; i < scanCount; i++) {
              await sessionService.addScannedArtifact(session.sessionId, artifactId);
            }

            // Retrieve session
            const retrievedSession = await sessionService.getSession(session.sessionId);

            // Property: All scans should be recorded (even duplicates)
            expect(retrievedSession).not.toBeNull();
            expect(retrievedSession!.scannedArtifacts).toHaveLength(scanCount);
            
            // All entries should be the same artifact
            for (const scanned of retrievedSession!.scannedArtifacts) {
              expect(scanned).toBe(artifactId);
            }

            // Cleanup
            await sessionService.deleteSession(session.sessionId);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
