import {
  HeritageSite,
  ArtifactReference,
  MultimediaContent,
  UserSession,
  Language,
  ContentType,
  ArtifactType,
  InteractionType,
  validateHeritageSite,
  validateMultimediaContent,
  validateUserSession,
  validateArtifactMetadata,
} from '../../src/models';

describe('Data Models and Validation', () => {
  describe('HeritageSite Interface and Validation', () => {
    const validHeritageSite: HeritageSite = {
      siteId: 'site-001',
      name: 'Lepakshi Temple',
      location: {
        latitude: 14.1291,
        longitude: 77.6156,
      },
      description: 'A 16th-century temple dedicated to Lord Veerabhadra',
      historicalPeriod: 'Vijayanagara Empire (1336-1646)',
      culturalSignificance: 'Architectural marvel with intricate stone carvings',
      artifacts: [
        {
          artifactId: 'artifact-001',
          name: 'Hanging Pillar',
          type: ArtifactType.PILLAR,
          location: { x: 10, y: 20, z: 0 },
          qrCodeData: 'LEPAKSHI_PILLAR_001',
          description: 'Famous hanging pillar that doesn\'t touch the ground',
        },
      ],
      supportedLanguages: [Language.ENGLISH, Language.HINDI, Language.TELUGU],
      metadata: {
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-12-01T00:00:00.000Z',
        version: '1.0.0',
        curator: 'Archaeological Survey of India',
        tags: ['temple', 'vijayanagara', 'architecture'],
        status: 'active',
      },
    };

    it('should validate a correct heritage site', () => {
      const result = validateHeritageSite(validHeritageSite);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.siteId).toBe('site-001');
        expect(result.data.name).toBe('Lepakshi Temple');
        expect(result.data.artifacts).toHaveLength(1);
      }
    });

    it('should reject heritage site with invalid coordinates', () => {
      const invalidSite = {
        ...validHeritageSite,
        location: {
          latitude: 200, // Invalid latitude
          longitude: 77.6156,
        },
      };

      const result = validateHeritageSite(invalidSite);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContainEqual(expect.stringContaining('latitude'));
      }
    });

    it('should reject heritage site with empty artifacts array', () => {
      const invalidSite = {
        ...validHeritageSite,
        artifacts: [],
      };

      const result = validateHeritageSite(invalidSite);
      expect(result.success).toBe(false);
    });

    it('should reject heritage site with no supported languages', () => {
      const invalidSite = {
        ...validHeritageSite,
        supportedLanguages: [],
      };

      const result = validateHeritageSite(invalidSite);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContainEqual(expect.stringContaining('supportedLanguages'));
      }
    });
  });

  describe('MultimediaContent Interface and Validation', () => {
    const validContent: MultimediaContent = {
      contentId: 'content-001',
      artifactId: 'artifact-001',
      contentType: ContentType.AUDIO_GUIDE,
      language: Language.ENGLISH,
      data: {
        text: 'Welcome to the Lepakshi Temple...',
        audioUrl: 'https://example.com/audio/lepakshi-en.mp3',
        duration: 180,
        fileSize: 2048000,
      },
      metadata: {
        siteId: 'site-001',
        artifactId: 'artifact-001',
        contentType: ContentType.AUDIO_GUIDE,
        language: Language.ENGLISH,
        version: '1.0.0',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-12-01T00:00:00.000Z',
        tags: ['audio', 'guide', 'english'],
      },
      cacheSettings: {
        ttl: 3600,
        priority: 8,
        tags: ['audio', 'popular'],
      },
    };

    it('should validate correct multimedia content', () => {
      const result = validateMultimediaContent(validContent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contentId).toBe('content-001');
        expect(result.data.contentType).toBe(ContentType.AUDIO_GUIDE);
        expect(result.data.language).toBe(Language.ENGLISH);
      }
    });

    it('should reject content with invalid URL', () => {
      const invalidContent = {
        ...validContent,
        data: {
          ...validContent.data,
          audioUrl: 'not-a-valid-url',
        },
      };

      const result = validateMultimediaContent(invalidContent);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContainEqual(expect.stringContaining('audioUrl'));
      }
    });

    it('should reject content with invalid cache priority', () => {
      const invalidContent = {
        ...validContent,
        cacheSettings: {
          ...validContent.cacheSettings,
          priority: 15, // Invalid priority (should be 1-10)
        },
      };

      const result = validateMultimediaContent(invalidContent);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContainEqual(expect.stringContaining('priority'));
      }
    });
  });

  describe('UserSession Interface and Validation', () => {
    const validSession: UserSession = {
      sessionId: 'session-001',
      userId: 'user-123',
      siteId: 'site-001',
      preferredLanguage: Language.HINDI,
      visitStartTime: '2023-12-01T10:00:00.000Z',
      scannedArtifacts: ['artifact-001', 'artifact-002'],
      contentInteractions: [
        {
          contentId: 'content-001',
          interactionType: InteractionType.PLAY,
          timestamp: '2023-12-01T10:05:00.000Z',
          duration: 180,
          completionPercentage: 100,
        },
      ],
      conversationHistory: [
        {
          id: 'qa-001',
          question: 'What is the significance of the hanging pillar?',
          answer: 'The hanging pillar is an architectural marvel...',
          timestamp: '2023-12-01T10:10:00.000Z',
          language: Language.HINDI,
          confidence: 0.95,
          sources: [
            {
              id: 'source-001',
              title: 'Lepakshi Temple Architecture',
              confidence: 0.9,
            },
          ],
        },
      ],
      preferences: {
        language: Language.HINDI,
        audioSpeed: 1.0,
        volume: 0.8,
        highContrast: false,
        largeText: false,
        audioDescriptions: true,
      },
    };

    it('should validate correct user session', () => {
      const result = validateUserSession(validSession);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionId).toBe('session-001');
        expect(result.data.preferredLanguage).toBe(Language.HINDI);
        expect(result.data.scannedArtifacts).toHaveLength(2);
        expect(result.data.contentInteractions).toHaveLength(1);
        expect(result.data.conversationHistory).toHaveLength(1);
      }
    });

    it('should reject session with invalid audio speed', () => {
      const invalidSession = {
        ...validSession,
        preferences: {
          ...validSession.preferences,
          audioSpeed: 3.0, // Invalid speed (should be 0.5-2.0)
        },
      };

      const result = validateUserSession(invalidSession);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContainEqual(expect.stringContaining('audioSpeed'));
      }
    });

    it('should reject session with invalid completion percentage', () => {
      const invalidSession = {
        ...validSession,
        contentInteractions: [
          {
            ...validSession.contentInteractions[0],
            completionPercentage: 150, // Invalid percentage (should be 0-100)
          },
        ],
      };

      const result = validateUserSession(invalidSession);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContainEqual(expect.stringContaining('completionPercentage'));
      }
    });
  });

  describe('ArtifactMetadata Validation', () => {
    const validArtifactMetadata = {
      artifactId: 'artifact-001',
      siteId: 'site-001',
      name: 'Hanging Pillar',
      type: ArtifactType.PILLAR,
      description: 'A pillar that appears to hang without touching the ground',
      historicalContext: 'Built during the Vijayanagara period',
      culturalSignificance: 'Demonstrates advanced architectural techniques',
      constructionPeriod: '16th century',
      materials: ['granite', 'sandstone'],
      dimensions: {
        height: 15.5,
        width: 2.0,
        depth: 2.0,
      },
      conservationStatus: 'Good',
      lastUpdated: '2023-12-01T00:00:00.000Z',
    };

    it('should validate correct artifact metadata', () => {
      const result = validateArtifactMetadata(validArtifactMetadata);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifactId).toBe('artifact-001');
        expect(result.data.type).toBe(ArtifactType.PILLAR);
        expect(result.data.materials).toContain('granite');
        expect(result.data.dimensions?.height).toBe(15.5);
      }
    });

    it('should reject artifact with negative dimensions', () => {
      const invalidArtifact = {
        ...validArtifactMetadata,
        dimensions: {
          height: -5, // Invalid negative height
          width: 2.0,
          depth: 2.0,
        },
      };

      const result = validateArtifactMetadata(invalidArtifact);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContainEqual(expect.stringContaining('height'));
      }
    });

    it('should validate artifact without optional fields', () => {
      const minimalArtifact = {
        artifactId: 'artifact-002',
        siteId: 'site-001',
        name: 'Stone Carving',
        type: ArtifactType.CARVING,
        description: 'Ancient stone carving',
        historicalContext: 'Medieval period',
        culturalSignificance: 'Religious significance',
        lastUpdated: '2023-12-01T00:00:00.000Z',
      };

      const result = validateArtifactMetadata(minimalArtifact);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifactId).toBe('artifact-002');
        expect(result.data.constructionPeriod).toBeUndefined();
        expect(result.data.materials).toBeUndefined();
        expect(result.data.dimensions).toBeUndefined();
      }
    });
  });

  describe('Type Safety', () => {
    it('should enforce type safety for enums', () => {
      // This test ensures TypeScript compilation catches invalid enum values
      const validLanguage: Language = Language.ENGLISH;
      const validContentType: ContentType = ContentType.AUDIO_GUIDE;
      const validArtifactType: ArtifactType = ArtifactType.PILLAR;
      const validInteractionType: InteractionType = InteractionType.PLAY;

      expect(validLanguage).toBe('en');
      expect(validContentType).toBe('audio_guide');
      expect(validArtifactType).toBe('pillar');
      expect(validInteractionType).toBe('play');
    });

    it('should provide proper type inference', () => {
      const site: HeritageSite = {
        siteId: 'test',
        name: 'Test Site',
        location: { latitude: 0, longitude: 0 },
        description: 'Test',
        historicalPeriod: 'Test',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          version: '1.0.0',
          curator: 'Test',
          tags: [],
          status: 'active',
        },
      };

      // TypeScript should infer the correct types
      expect(typeof site.siteId).toBe('string');
      expect(typeof site.location.latitude).toBe('number');
      expect(Array.isArray(site.artifacts)).toBe(true);
      expect(Array.isArray(site.supportedLanguages)).toBe(true);
    });
  });
});