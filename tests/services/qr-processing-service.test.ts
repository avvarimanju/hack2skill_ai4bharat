// Unit tests for QRProcessingService
import { QRProcessingService } from '../../src/services/qr-processing-service';
import { RepositoryFactory } from '../../src/repositories';
import { ArtifactType, Language } from '../../src/models/common';

// Mock repositories
jest.mock('../../src/repositories');
jest.mock('../../src/utils/logger');

describe('QRProcessingService', () => {
  let service: QRProcessingService;
  let mockArtifactsRepo: any;
  let mockHeritageSitesRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock repositories
    mockArtifactsRepo = {
      getByArtifactId: jest.fn(),
    };
    
    mockHeritageSitesRepo = {
      getBySiteId: jest.fn(),
    };
    
    (RepositoryFactory.getArtifactsRepository as jest.Mock).mockReturnValue(mockArtifactsRepo);
    (RepositoryFactory.getHeritageSitesRepository as jest.Mock).mockReturnValue(mockHeritageSitesRepo);
    
    service = new QRProcessingService();
  });

  describe('processQRScan', () => {
    const mockArtifact = {
      artifactId: 'artifact-1',
      siteId: 'site-1',
      name: 'Test Artifact',
      type: ArtifactType.PILLAR,
      description: 'Test description',
      historicalContext: 'Test context',
      culturalSignificance: 'Test significance',
      lastUpdated: '2024-01-01T00:00:00.000Z',
    };

    const mockSite = {
      siteId: 'site-1',
      name: 'Test Site',
      location: { latitude: 12.9716, longitude: 77.5946 },
      description: 'Test site',
      historicalPeriod: '12th Century',
      culturalSignificance: 'Important site',
      artifacts: [],
      supportedLanguages: [Language.ENGLISH],
      metadata: {
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        version: '1.0',
        curator: 'Test',
        tags: [],
        status: 'active' as const,
      },
    };

    it('should process valid URI format QR code', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      const result = await service.processQRScan({
        qrData: 'avvari://site-1/artifact-1?timestamp=2024-01-01T00:00:00.000Z',
      });

      expect(result.success).toBe(true);
      expect(result.artifactIdentifier).toBeDefined();
      expect(result.artifactIdentifier?.siteId).toBe('site-1');
      expect(result.artifactIdentifier?.artifactId).toBe('artifact-1');
      expect(result.artifactMetadata).toEqual(mockArtifact);
      expect(result.siteMetadata).toEqual(mockSite);
    });

    it('should process valid JSON format QR code', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      const qrData = JSON.stringify({
        siteId: 'site-1',
        artifactId: 'artifact-1',
        timestamp: '2024-01-01T00:00:00.000Z',
      });

      const result = await service.processQRScan({ qrData });

      expect(result.success).toBe(true);
      expect(result.artifactIdentifier?.siteId).toBe('site-1');
      expect(result.artifactIdentifier?.artifactId).toBe('artifact-1');
    });

    it('should process valid simple format QR code', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      const result = await service.processQRScan({
        qrData: 'site-1:artifact-1',
      });

      expect(result.success).toBe(true);
      expect(result.artifactIdentifier?.siteId).toBe('site-1');
      expect(result.artifactIdentifier?.artifactId).toBe('artifact-1');
    });

    it('should fail with invalid QR data', async () => {
      const result = await service.processQRScan({
        qrData: 'invalid-qr-data',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid QR code format');
    });

    it('should fail with empty QR data', async () => {
      const result = await service.processQRScan({
        qrData: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail when artifact not found', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(null);

      const result = await service.processQRScan({
        qrData: 'avvari://site-1/artifact-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Artifact not found in database');
    });

    it('should fail when site not found', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(null);

      const result = await service.processQRScan({
        qrData: 'avvari://site-1/artifact-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Heritage site not found in database');
    });

    it('should verify location when provided', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      const result = await service.processQRScan({
        qrData: 'avvari://site-1/artifact-1',
        location: { latitude: 12.9716, longitude: 77.5946 }, // Same as site
      });

      expect(result.success).toBe(true);
    });

    it('should handle location verification for remote users', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      const result = await service.processQRScan({
        qrData: 'avvari://site-1/artifact-1',
        location: { latitude: 0, longitude: 0 }, // Far from site
      });

      // Should still succeed but log warning
      expect(result.success).toBe(true);
    });
  });

  describe('validateQRCodeFormat', () => {
    it('should validate JSON format', () => {
      const result = service.validateQRCodeFormat(
        JSON.stringify({ siteId: 'site-1', artifactId: 'artifact-1' })
      );

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('json');
    });

    it('should validate URI format', () => {
      const result = service.validateQRCodeFormat('avvari://site-1/artifact-1');

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('uri');
    });

    it('should validate simple format', () => {
      const result = service.validateQRCodeFormat('site-1:artifact-1');

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('simple');
    });

    it('should reject empty QR data', () => {
      const result = service.validateQRCodeFormat('');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('QR data is empty');
    });

    it('should reject invalid JSON', () => {
      const result = service.validateQRCodeFormat('{invalid json}');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid JSON format');
    });

    it('should reject JSON missing required fields', () => {
      const result = service.validateQRCodeFormat(JSON.stringify({ siteId: 'site-1' }));

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('JSON missing required fields');
    });

    it('should reject invalid URI', () => {
      const result = service.validateQRCodeFormat('avvari://invalid');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('URI missing required path components');
    });

    it('should reject unrecognized format', () => {
      const result = service.validateQRCodeFormat('random-text');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unrecognized QR code format');
    });
  });

  describe('isQRCodeCorrupted', () => {
    it('should detect null bytes', () => {
      const result = service.isQRCodeCorrupted('site-1\0artifact-1');
      expect(result).toBe(true);
    });

    it('should detect replacement characters', () => {
      const result = service.isQRCodeCorrupted('site-1�artifact-1');
      expect(result).toBe(true);
    });

    it('should detect too short data', () => {
      const result = service.isQRCodeCorrupted('short');
      expect(result).toBe(true);
    });

    it('should detect too long data', () => {
      const result = service.isQRCodeCorrupted('a'.repeat(1001));
      expect(result).toBe(true);
    });

    it('should accept valid QR data', () => {
      const result = service.isQRCodeCorrupted('avvari://site-1/artifact-1');
      expect(result).toBe(false);
    });

    it('should accept valid JSON', () => {
      const result = service.isQRCodeCorrupted(
        JSON.stringify({ siteId: 'site-1', artifactId: 'artifact-1' })
      );
      expect(result).toBe(false);
    });
  });

  describe('generateQRCodeData', () => {
    it('should generate JSON format', () => {
      const result = service.generateQRCodeData('site-1', 'artifact-1', 'json');
      const parsed = JSON.parse(result);

      expect(parsed.siteId).toBe('site-1');
      expect(parsed.artifactId).toBe('artifact-1');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should generate URI format', () => {
      const result = service.generateQRCodeData('site-1', 'artifact-1', 'uri');

      expect(result).toContain('avvari://site-1/artifact-1');
      expect(result).toContain('timestamp=');
    });

    it('should generate simple format', () => {
      const result = service.generateQRCodeData('site-1', 'artifact-1', 'simple');

      expect(result).toBe('site-1:artifact-1');
    });

    it('should default to URI format', () => {
      const result = service.generateQRCodeData('site-1', 'artifact-1');

      expect(result).toContain('avvari://');
    });
  });
});
