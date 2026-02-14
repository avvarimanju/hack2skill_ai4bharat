import {
  SiteManagementService,
  SiteCreationRequest,
  ArtifactCreationRequest,
} from '../../src/services/site-management-service';
import { HeritageSitesRepository } from '../../src/repositories/heritage-sites-repository';
import {
  HeritageSite,
  Language,
  ArtifactType,
  ArtifactReference,
} from '../../src/models/common';

describe('SiteManagementService', () => {
  let service: SiteManagementService;
  let mockRepository: jest.Mocked<HeritageSitesRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      getBySiteId: jest.fn(),
      updateSite: jest.fn(),
      deleteSite: jest.fn(),
      getAllSites: jest.fn(),
      getSitesByStatus: jest.fn(),
      getSitesByLanguage: jest.fn(),
      searchSites: jest.fn(),
      getSitesByProximity: jest.fn(),
      addArtifact: jest.fn(),
      removeArtifact: jest.fn(),
      updateArtifact: jest.fn(),
      getHeritageSiteCacheStats: jest.fn(),
    } as any;

    service = new SiteManagementService(mockRepository);
  });

  describe('initialization', () => {
    it('should initialize with repository', () => {
      mockRepository.getHeritageSiteCacheStats.mockReturnValue({
        size: 0,
        hitRate: 0,
      });

      expect(service).toBeDefined();
      expect(service.getStatus().healthy).toBe(true);
    });
  });

  describe('createSite', () => {
    it('should create a new heritage site', async () => {
      const request: SiteCreationRequest = {
        name: 'Lepakshi Temple',
        location: { latitude: 13.8283, longitude: 77.6047 },
        description: 'Ancient temple with hanging pillar',
        historicalPeriod: '16th century',
        culturalSignificance: 'Vijayanagara architecture',
        supportedLanguages: [Language.ENGLISH, Language.TELUGU],
        curator: 'curator@example.com',
        tags: ['temple', 'architecture'],
      };

      mockRepository.create.mockResolvedValue(undefined);

      const site = await service.createSite(request);

      expect(site.name).toBe(request.name);
      expect(site.location).toEqual(request.location);
      expect(site.supportedLanguages).toEqual(request.supportedLanguages);
      expect(site.metadata.status).toBe('active');
      expect(site.metadata.curator).toBe(request.curator);
      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        name: request.name,
      }));
    });

    it('should generate unique site ID', async () => {
      const request: SiteCreationRequest = {
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test description',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        supportedLanguages: [Language.ENGLISH],
        curator: 'test@example.com',
      };

      mockRepository.create.mockResolvedValue(undefined);

      const site1 = await service.createSite(request);
      const site2 = await service.createSite(request);

      expect(site1.siteId).not.toBe(site2.siteId);
    });

    it('should validate site data', async () => {
      const invalidRequest: SiteCreationRequest = {
        name: '',
        location: { latitude: 10, longitude: 20 },
        description: '',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        supportedLanguages: [],
        curator: 'test@example.com',
      };

      await expect(service.createSite(invalidRequest)).rejects.toThrow('Site validation failed');
    });

    it('should set default values', async () => {
      const request: SiteCreationRequest = {
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        supportedLanguages: [Language.ENGLISH],
        curator: 'test@example.com',
      };

      mockRepository.create.mockResolvedValue(undefined);

      const site = await service.createSite(request);

      expect(site.artifacts).toEqual([]);
      expect(site.metadata.version).toBe('1.0.0');
      expect(site.metadata.tags).toEqual([]);
    });
  });

  describe('addArtifact', () => {
    it('should add artifact to site', async () => {
      const siteId = 'test-site';
      const artifact: ArtifactCreationRequest = {
        name: 'Hanging Pillar',
        type: ArtifactType.PILLAR,
        location: { x: 10, y: 20, z: 0 },
        description: 'Famous hanging pillar',
      };

      const mockSite: HeritageSite = {
        siteId,
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          curator: 'test',
          tags: [],
          status: 'active',
        },
      };

      mockRepository.addArtifact.mockResolvedValue(mockSite);

      const result = await service.addArtifact(siteId, artifact);

      expect(result).toBeDefined();
      expect(mockRepository.addArtifact).toHaveBeenCalledWith(
        siteId,
        expect.objectContaining({
          name: artifact.name,
          type: artifact.type,
        })
      );
    });

    it('should generate artifact ID', async () => {
      const siteId = 'test-site';
      const artifact: ArtifactCreationRequest = {
        name: 'Test Artifact',
        type: ArtifactType.STATUE,
        location: { x: 0, y: 0 },
        description: 'Test',
      };

      const mockSite: HeritageSite = {
        siteId,
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          curator: 'test',
          tags: [],
          status: 'active',
        },
      };

      mockRepository.addArtifact.mockResolvedValue(mockSite);

      await service.addArtifact(siteId, artifact);

      expect(mockRepository.addArtifact).toHaveBeenCalledWith(
        siteId,
        expect.objectContaining({
          artifactId: expect.stringContaining(siteId),
        })
      );
    });

    it('should generate QR code data if not provided', async () => {
      const siteId = 'test-site';
      const artifact: ArtifactCreationRequest = {
        name: 'Test Artifact',
        type: ArtifactType.STATUE,
        location: { x: 0, y: 0 },
        description: 'Test',
      };

      const mockSite: HeritageSite = {
        siteId,
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          curator: 'test',
          tags: [],
          status: 'active',
        },
      };

      mockRepository.addArtifact.mockResolvedValue(mockSite);

      await service.addArtifact(siteId, artifact);

      expect(mockRepository.addArtifact).toHaveBeenCalledWith(
        siteId,
        expect.objectContaining({
          qrCodeData: expect.any(String),
        })
      );
    });

    it('should use provided QR code data', async () => {
      const siteId = 'test-site';
      const qrData = 'custom-qr-data';
      const artifact: ArtifactCreationRequest = {
        name: 'Test Artifact',
        type: ArtifactType.STATUE,
        location: { x: 0, y: 0 },
        description: 'Test',
        qrCodeData: qrData,
      };

      const mockSite: HeritageSite = {
        siteId,
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          curator: 'test',
          tags: [],
          status: 'active',
        },
      };

      mockRepository.addArtifact.mockResolvedValue(mockSite);

      await service.addArtifact(siteId, artifact);

      expect(mockRepository.addArtifact).toHaveBeenCalledWith(
        siteId,
        expect.objectContaining({
          qrCodeData: qrData,
        })
      );
    });

    it('should throw error if site not found', async () => {
      mockRepository.addArtifact.mockResolvedValue(null);

      await expect(
        service.addArtifact('non-existent', {
          name: 'Test',
          type: ArtifactType.STATUE,
          location: { x: 0, y: 0 },
          description: 'Test',
        })
      ).rejects.toThrow('Site not found');
    });
  });

  describe('removeArtifact', () => {
    it('should remove artifact from site', async () => {
      const siteId = 'test-site';
      const artifactId = 'test-artifact';

      const mockSite: HeritageSite = {
        siteId,
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          curator: 'test',
          tags: [],
          status: 'active',
        },
      };

      mockRepository.removeArtifact.mockResolvedValue(mockSite);

      const result = await service.removeArtifact(siteId, artifactId);

      expect(result).toBeDefined();
      expect(mockRepository.removeArtifact).toHaveBeenCalledWith(siteId, artifactId);
    });

    it('should throw error if site or artifact not found', async () => {
      mockRepository.removeArtifact.mockResolvedValue(null);

      await expect(service.removeArtifact('site', 'artifact')).rejects.toThrow(
        'Site or artifact not found'
      );
    });
  });

  describe('updateArtifact', () => {
    it('should update artifact information', async () => {
      const siteId = 'test-site';
      const artifactId = 'test-artifact';
      const updates: Partial<ArtifactReference> = {
        description: 'Updated description',
      };

      const mockSite: HeritageSite = {
        siteId,
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          curator: 'test',
          tags: [],
          status: 'active',
        },
      };

      mockRepository.updateArtifact.mockResolvedValue(mockSite);

      const result = await service.updateArtifact(siteId, artifactId, updates);

      expect(result).toBeDefined();
      expect(mockRepository.updateArtifact).toHaveBeenCalledWith(siteId, artifactId, updates);
    });

    it('should throw error if site or artifact not found', async () => {
      mockRepository.updateArtifact.mockResolvedValue(null);

      await expect(service.updateArtifact('site', 'artifact', {})).rejects.toThrow(
        'Site or artifact not found'
      );
    });
  });

  describe('updateSite', () => {
    it('should update site information', async () => {
      const siteId = 'test-site';
      const updates: Partial<HeritageSite> = {
        description: 'Updated description',
      };

      const mockSite: HeritageSite = {
        siteId,
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Updated description',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          curator: 'test',
          tags: [],
          status: 'active',
        },
      };

      mockRepository.updateSite.mockResolvedValue(mockSite);

      const result = await service.updateSite(siteId, updates);

      expect(result).toBeDefined();
      expect(mockRepository.updateSite).toHaveBeenCalledWith(siteId, updates);
    });

    it('should throw error if site not found', async () => {
      mockRepository.updateSite.mockResolvedValue(null);

      await expect(service.updateSite('non-existent', {})).rejects.toThrow('Site not found');
    });
  });

  describe('bulkUpdateSites', () => {
    it('should perform bulk updates', async () => {
      const updates = [
        { siteId: 'site1', updates: { description: 'Updated 1' } },
        { siteId: 'site2', updates: { description: 'Updated 2' } },
      ];

      const mockSite: HeritageSite = {
        siteId: 'site1',
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          curator: 'test',
          tags: [],
          status: 'active',
        },
      };

      mockRepository.updateSite.mockResolvedValue(mockSite);

      const result = await service.bulkUpdateSites(updates);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(mockRepository.updateSite).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures', async () => {
      const updates = [
        { siteId: 'site1', updates: { description: 'Updated 1' } },
        { siteId: 'site2', updates: { description: 'Updated 2' } },
      ];

      const mockSite: HeritageSite = {
        siteId: 'site1',
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          curator: 'test',
          tags: [],
          status: 'active',
        },
      };

      // First call succeeds, second call fails (returns null which triggers error)
      mockRepository.updateSite
        .mockResolvedValueOnce(mockSite)
        .mockRejectedValueOnce(new Error('Site not found'));

      const result = await service.bulkUpdateSites(updates);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].siteId).toBe('site2');
    });
  });

  describe('getSite', () => {
    it('should get site by ID', async () => {
      const siteId = 'test-site';
      const mockSite: HeritageSite = {
        siteId,
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          curator: 'test',
          tags: [],
          status: 'active',
        },
      };

      mockRepository.getBySiteId.mockResolvedValue(mockSite);

      const result = await service.getSite(siteId);

      expect(result).toEqual(mockSite);
      expect(mockRepository.getBySiteId).toHaveBeenCalledWith(siteId);
    });

    it('should return null if site not found', async () => {
      mockRepository.getBySiteId.mockResolvedValue(null);

      const result = await service.getSite('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAllSites', () => {
    it('should get all sites', async () => {
      const mockSites: HeritageSite[] = [
        {
          siteId: 'site1',
          name: 'Site 1',
          location: { latitude: 10, longitude: 20 },
          description: 'Test',
          historicalPeriod: 'Modern',
          culturalSignificance: 'Test',
          artifacts: [],
          supportedLanguages: [Language.ENGLISH],
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: '1.0.0',
            curator: 'test',
            tags: [],
            status: 'active',
          },
        },
      ];

      mockRepository.getAllSites.mockResolvedValue(mockSites);

      const result = await service.getAllSites();

      expect(result).toEqual(mockSites);
      expect(mockRepository.getAllSites).toHaveBeenCalled();
    });
  });

  describe('getSitesByStatus', () => {
    it('should get sites by status', async () => {
      const mockSites: HeritageSite[] = [];
      mockRepository.getSitesByStatus.mockResolvedValue(mockSites);

      const result = await service.getSitesByStatus('active');

      expect(result).toEqual(mockSites);
      expect(mockRepository.getSitesByStatus).toHaveBeenCalledWith('active');
    });
  });

  describe('searchSites', () => {
    it('should search sites', async () => {
      const mockSites: HeritageSite[] = [];
      mockRepository.searchSites.mockResolvedValue(mockSites);

      const result = await service.searchSites('temple');

      expect(result).toEqual(mockSites);
      expect(mockRepository.searchSites).toHaveBeenCalledWith('temple');
    });
  });

  describe('getSitesByLanguage', () => {
    it('should get sites by language', async () => {
      const mockSites: HeritageSite[] = [];
      mockRepository.getSitesByLanguage.mockResolvedValue(mockSites);

      const result = await service.getSitesByLanguage(Language.HINDI);

      expect(result).toEqual(mockSites);
      expect(mockRepository.getSitesByLanguage).toHaveBeenCalledWith(Language.HINDI);
    });
  });

  describe('getSitesNearLocation', () => {
    it('should get sites near location', async () => {
      const location = { latitude: 10, longitude: 20 };
      const mockSites: HeritageSite[] = [];
      mockRepository.getSitesByProximity.mockResolvedValue(mockSites);

      const result = await service.getSitesNearLocation(location, 50);

      expect(result).toEqual(mockSites);
      expect(mockRepository.getSitesByProximity).toHaveBeenCalledWith(10, 20, 50);
    });
  });

  describe('deleteSite', () => {
    it('should delete site', async () => {
      const siteId = 'test-site';
      const mockSite: HeritageSite = {
        siteId,
        name: 'Test Site',
        location: { latitude: 10, longitude: 20 },
        description: 'Test',
        historicalPeriod: 'Modern',
        culturalSignificance: 'Test',
        artifacts: [],
        supportedLanguages: [Language.ENGLISH],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          curator: 'test',
          tags: [],
          status: 'active',
        },
      };

      mockRepository.deleteSite.mockResolvedValue(mockSite);

      const result = await service.deleteSite(siteId);

      expect(result).toEqual(mockSite);
      expect(mockRepository.deleteSite).toHaveBeenCalledWith(siteId);
    });

    it('should throw error if site not found', async () => {
      mockRepository.deleteSite.mockResolvedValue(null);

      await expect(service.deleteSite('non-existent')).rejects.toThrow('Site not found');
    });
  });

  describe('getManagementStats', () => {
    it('should calculate management statistics', async () => {
      const mockSites: HeritageSite[] = [
        {
          siteId: 'site1',
          name: 'Site 1',
          location: { latitude: 10, longitude: 20 },
          description: 'Test',
          historicalPeriod: 'Modern',
          culturalSignificance: 'Test',
          artifacts: [
            {
              artifactId: 'art1',
              name: 'Artifact 1',
              type: ArtifactType.STATUE,
              location: { x: 0, y: 0 },
              qrCodeData: 'data',
              description: 'Test',
            },
          ],
          supportedLanguages: [Language.ENGLISH, Language.HINDI],
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: '1.0.0',
            curator: 'test',
            tags: [],
            status: 'active',
          },
        },
        {
          siteId: 'site2',
          name: 'Site 2',
          location: { latitude: 10, longitude: 20 },
          description: 'Test',
          historicalPeriod: 'Modern',
          culturalSignificance: 'Test',
          artifacts: [],
          supportedLanguages: [Language.TAMIL],
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: '1.0.0',
            curator: 'test',
            tags: [],
            status: 'inactive',
          },
        },
      ];

      mockRepository.getAllSites.mockResolvedValue(mockSites);

      const stats = await service.getManagementStats();

      expect(stats.totalSites).toBe(2);
      expect(stats.activeSites).toBe(1);
      expect(stats.inactiveSites).toBe(1);
      expect(stats.maintenanceSites).toBe(0);
      expect(stats.totalArtifacts).toBe(1);
      expect(stats.languageCoverage[Language.ENGLISH]).toBe(1);
      expect(stats.languageCoverage[Language.HINDI]).toBe(1);
      expect(stats.languageCoverage[Language.TAMIL]).toBe(1);
    });
  });

  describe('getStatus', () => {
    it('should return service status', () => {
      mockRepository.getHeritageSiteCacheStats.mockReturnValue({
        size: 10,
        hitRate: 0.85,
      });

      const status = service.getStatus();

      expect(status.healthy).toBe(true);
      expect(status.stats.cacheSize).toBe(10);
      expect(status.stats.cacheHitRate).toBe(0.85);
    });
  });
});
