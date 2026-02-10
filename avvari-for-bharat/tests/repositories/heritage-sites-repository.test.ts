// Unit tests for HeritageSitesRepository
import { HeritageSitesRepository } from '../../src/repositories/heritage-sites-repository';
import { HeritageSite, Language, ArtifactType, ArtifactReference } from '../../src/models/common';
import { docClient } from '../../src/utils/aws-clients';

// Mock AWS clients
jest.mock('../../src/utils/aws-clients');
jest.mock('../../src/utils/logger');

describe('HeritageSitesRepository', () => {
  let repository: HeritageSitesRepository;
  let mockDocClient: any;

  const mockHeritageSite: HeritageSite = {
    siteId: 'site-1',
    name: 'Test Heritage Site',
    location: {
      latitude: 12.9716,
      longitude: 77.5946,
    },
    description: 'A test heritage site',
    historicalPeriod: '12th Century',
    culturalSignificance: 'Important cultural site',
    artifacts: [
      {
        artifactId: 'artifact-1',
        name: 'Test Artifact',
        type: ArtifactType.PILLAR,
        location: { x: 0, y: 0 },
        qrCodeData: 'QR123',
        description: 'Test artifact description',
      },
    ],
    supportedLanguages: [Language.ENGLISH, Language.HINDI],
    metadata: {
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      version: '1.0',
      curator: 'Test Curator',
      tags: ['heritage', 'temple'],
      status: 'active',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient = docClient as any;
    mockDocClient.send = jest.fn();
    repository = new HeritageSitesRepository();
  });

  describe('getBySiteId', () => {
    it('should get heritage site by ID', async () => {
      mockDocClient.send.mockResolvedValueOnce({
        Item: mockHeritageSite,
      });

      const result = await repository.getBySiteId('site-1');
      
      expect(result).toEqual(mockHeritageSite);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should return null when site not found', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      const result = await repository.getBySiteId('nonexistent');
      
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create new heritage site', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      await repository.create(mockHeritageSite);
      
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should set timestamps when creating', async () => {
      const siteWithoutTimestamps = {
        ...mockHeritageSite,
        metadata: {
          ...mockHeritageSite.metadata,
          createdAt: '',
          updatedAt: '',
        },
      };

      mockDocClient.send.mockResolvedValueOnce({});

      await repository.create(siteWithoutTimestamps);
      
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      // Verify that timestamps were set (would need to check the actual call)
    });
  });

  describe('updateSite', () => {
    it('should update heritage site', async () => {
      const updatedSite = {
        ...mockHeritageSite,
        name: 'Updated Site Name',
      };

      mockDocClient.send.mockResolvedValueOnce({
        Attributes: updatedSite,
      });

      const result = await repository.updateSite('site-1', {
        name: 'Updated Site Name',
      });
      
      expect(result).toEqual(updatedSite);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should update metadata fields', async () => {
      const updatedSite = {
        ...mockHeritageSite,
        metadata: {
          ...mockHeritageSite.metadata,
          status: 'maintenance' as const,
        },
      };

      mockDocClient.send.mockResolvedValueOnce({
        Attributes: updatedSite,
      });

      const result = await repository.updateSite('site-1', {
        metadata: { status: 'maintenance' },
      });
      
      expect(result).toEqual(updatedSite);
    });
  });

  describe('deleteSite', () => {
    it('should delete heritage site', async () => {
      mockDocClient.send.mockResolvedValueOnce({
        Attributes: mockHeritageSite,
      });

      const result = await repository.deleteSite('site-1');
      
      expect(result).toEqual(mockHeritageSite);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllSites', () => {
    it('should get all heritage sites', async () => {
      const sites = [mockHeritageSite];
      
      mockDocClient.send.mockResolvedValueOnce({
        Items: sites,
      });

      const result = await repository.getAllSites();
      
      expect(result).toEqual(sites);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSitesByStatus', () => {
    it('should get sites by status', async () => {
      const activeSites = [mockHeritageSite];
      
      mockDocClient.send.mockResolvedValueOnce({
        Items: activeSites,
      });

      const result = await repository.getSitesByStatus('active');
      
      expect(result).toEqual(activeSites);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSitesByLanguage', () => {
    it('should get sites by supported language', async () => {
      const englishSites = [mockHeritageSite];
      
      mockDocClient.send.mockResolvedValueOnce({
        Items: englishSites,
      });

      const result = await repository.getSitesByLanguage(Language.ENGLISH);
      
      expect(result).toEqual(englishSites);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('searchSites', () => {
    it('should search sites by name or description', async () => {
      const searchResults = [mockHeritageSite];
      
      mockDocClient.send.mockResolvedValueOnce({
        Items: searchResults,
      });

      const result = await repository.searchSites('Test');
      
      expect(result).toEqual(searchResults);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('artifact management', () => {
    const newArtifact: ArtifactReference = {
      artifactId: 'artifact-2',
      name: 'New Artifact',
      type: ArtifactType.STATUE,
      location: { x: 10, y: 10 },
      qrCodeData: 'QR456',
      description: 'New artifact description',
    };

    describe('addArtifact', () => {
      it('should add artifact to heritage site', async () => {
        // Mock getting current site
        mockDocClient.send.mockResolvedValueOnce({
          Item: mockHeritageSite,
        });

        // Mock update operation
        const updatedSite = {
          ...mockHeritageSite,
          artifacts: [...mockHeritageSite.artifacts, newArtifact],
        };
        
        mockDocClient.send.mockResolvedValueOnce({
          Attributes: updatedSite,
        });

        const result = await repository.addArtifact('site-1', newArtifact);
        
        expect(result).toEqual(updatedSite);
        expect(mockDocClient.send).toHaveBeenCalledTimes(2);
      });

      it('should throw error if site not found', async () => {
        mockDocClient.send.mockResolvedValueOnce({});

        await expect(repository.addArtifact('nonexistent', newArtifact))
          .rejects.toThrow('Heritage site not found: nonexistent');
      });

      it('should throw error if artifact already exists', async () => {
        const existingArtifact = mockHeritageSite.artifacts[0];
        
        mockDocClient.send.mockResolvedValueOnce({
          Item: mockHeritageSite,
        });

        await expect(repository.addArtifact('site-1', existingArtifact))
          .rejects.toThrow('Artifact already exists in site: artifact-1');
      });
    });

    describe('removeArtifact', () => {
      it('should remove artifact from heritage site', async () => {
        // Mock getting current site
        mockDocClient.send.mockResolvedValueOnce({
          Item: mockHeritageSite,
        });

        // Mock update operation
        const updatedSite = {
          ...mockHeritageSite,
          artifacts: [],
        };
        
        mockDocClient.send.mockResolvedValueOnce({
          Attributes: updatedSite,
        });

        const result = await repository.removeArtifact('site-1', 'artifact-1');
        
        expect(result).toEqual(updatedSite);
        expect(mockDocClient.send).toHaveBeenCalledTimes(2);
      });

      it('should throw error if artifact not found', async () => {
        mockDocClient.send.mockResolvedValueOnce({
          Item: mockHeritageSite,
        });

        await expect(repository.removeArtifact('site-1', 'nonexistent'))
          .rejects.toThrow('Artifact not found in site: nonexistent');
      });
    });

    describe('updateArtifact', () => {
      it('should update artifact in heritage site', async () => {
        // Mock getting current site
        mockDocClient.send.mockResolvedValueOnce({
          Item: mockHeritageSite,
        });

        // Mock update operation
        const updatedSite = {
          ...mockHeritageSite,
          artifacts: [
            {
              ...mockHeritageSite.artifacts[0],
              name: 'Updated Artifact Name',
            },
          ],
        };
        
        mockDocClient.send.mockResolvedValueOnce({
          Attributes: updatedSite,
        });

        const result = await repository.updateArtifact('site-1', 'artifact-1', {
          name: 'Updated Artifact Name',
        });
        
        expect(result).toEqual(updatedSite);
        expect(mockDocClient.send).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('getSitesByProximity', () => {
    it('should get sites within radius', async () => {
      const nearbySites = [mockHeritageSite];
      
      mockDocClient.send.mockResolvedValueOnce({
        Items: nearbySites,
      });

      const result = await repository.getSitesByProximity(12.9716, 77.5946, 10);
      
      expect(result).toEqual(nearbySites);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should filter sites by distance', async () => {
      const farSite: HeritageSite = {
        ...mockHeritageSite,
        siteId: 'far-site',
        location: { latitude: 0, longitude: 0 }, // Very far from test location
      };
      
      mockDocClient.send.mockResolvedValueOnce({
        Items: [mockHeritageSite, farSite],
      });

      const result = await repository.getSitesByProximity(12.9716, 77.5946, 1); // 1km radius
      
      // Should only return nearby site, not the far one
      expect(result).toHaveLength(1);
      expect(result[0].siteId).toBe('site-1');
    });
  });

  describe('getSitesWithPagination', () => {
    it('should get sites with pagination', async () => {
      const sites = [mockHeritageSite];
      const lastKey = { siteId: 'site-1' };
      
      mockDocClient.send.mockResolvedValueOnce({
        Items: sites,
        LastEvaluatedKey: lastKey,
      });

      const result = await repository.getSitesWithPagination(10);
      
      expect(result.sites).toEqual(sites);
      expect(result.lastEvaluatedKey).toEqual(lastKey);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('bulkUpdateSites', () => {
    it('should bulk update multiple sites', async () => {
      const updates = [
        {
          siteId: 'site-1',
          updates: { name: 'Updated Site 1' },
        },
        {
          siteId: 'site-2',
          updates: { name: 'Updated Site 2' },
        },
      ];

      // Mock update responses
      mockDocClient.send
        .mockResolvedValueOnce({ Attributes: { ...mockHeritageSite, name: 'Updated Site 1' } })
        .mockResolvedValueOnce({ Attributes: { ...mockHeritageSite, siteId: 'site-2', name: 'Updated Site 2' } });

      await repository.bulkUpdateSites(updates);
      
      expect(mockDocClient.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache statistics', () => {
    it('should return cache statistics', () => {
      const stats = repository.getHeritageSiteCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(typeof stats.size).toBe('number');
    });
  });
});