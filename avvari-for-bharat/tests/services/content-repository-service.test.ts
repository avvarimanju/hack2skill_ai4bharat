// Unit tests for ContentRepositoryService
import { ContentRepositoryService } from '../../src/services/content-repository-service';
import { Language } from '../../src/models/common';
import { S3Client } from '@aws-sdk/client-s3';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('../../src/utils/logger');

describe('ContentRepositoryService', () => {
  let service: ContentRepositoryService;
  let mockS3Send: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock S3 client send method
    mockS3Send = jest.fn();
    (S3Client as jest.Mock).mockImplementation(() => ({
      send: mockS3Send,
    }));

    service = new ContentRepositoryService('test-bucket', 'test-cdn.com', 'us-east-1');
  });

  describe('uploadContent', () => {
    it('should upload content successfully', async () => {
      mockS3Send.mockResolvedValue({});

      const result = await service.uploadContent({
        siteId: 'site-123',
        artifactId: 'artifact-456',
        contentType: 'image',
        language: Language.ENGLISH,
        data: Buffer.from('test data'),
        mimeType: 'image/jpeg',
      });

      expect(result.success).toBe(true);
      expect(result.cdnUrl).toContain('test-cdn.com');
      expect(result.s3Key).toBeDefined();
      expect(mockS3Send).toHaveBeenCalled();
    });

    it('should handle missing site ID', async () => {
      const result = await service.uploadContent({
        siteId: '',
        contentType: 'image',
        language: Language.ENGLISH,
        data: Buffer.from('test'),
        mimeType: 'image/jpeg',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Site ID is required');
    });

    it('should handle missing data', async () => {
      const result = await service.uploadContent({
        siteId: 'site-123',
        contentType: 'image',
        language: Language.ENGLISH,
        data: '' as any,
        mimeType: 'image/jpeg',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content data is required');
    });

    it('should upload with custom metadata', async () => {
      mockS3Send.mockResolvedValue({});

      const result = await service.uploadContent({
        siteId: 'site-123',
        contentType: 'video',
        language: Language.HINDI,
        data: Buffer.from('video data'),
        mimeType: 'video/mp4',
        metadata: {
          duration: '120',
          resolution: '1080p',
        },
      });

      expect(result.success).toBe(true);
      expect(mockS3Send).toHaveBeenCalled();
    });

    it('should handle S3 upload error', async () => {
      mockS3Send.mockRejectedValue(new Error('S3 upload failed'));

      const result = await service.uploadContent({
        siteId: 'site-123',
        contentType: 'image',
        language: Language.ENGLISH,
        data: Buffer.from('test'),
        mimeType: 'image/jpeg',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('S3 upload failed');
    });

    it('should use custom cache control', async () => {
      mockS3Send.mockResolvedValue({});

      await service.uploadContent({
        siteId: 'site-123',
        contentType: 'image',
        language: Language.ENGLISH,
        data: Buffer.from('test'),
        mimeType: 'image/jpeg',
        cacheControl: 'no-cache',
      });

      expect(mockS3Send).toHaveBeenCalled();
    });
  });

  describe('retrieveContent', () => {
    it('should retrieve content successfully', async () => {
      const mockStream = {
        on: jest.fn(function(this: any, event: string, handler: any) {
          if (event === 'data') {
            handler(Buffer.from('test data'));
          }
          if (event === 'end') {
            handler();
          }
          return this;
        }),
      };

      mockS3Send.mockResolvedValue({
        Body: mockStream,
        Metadata: {
          siteId: 'site-123',
          contentType: 'image',
        },
      });

      const result = await service.retrieveContent({
        siteId: 'site-123',
        artifactId: 'artifact-456',
        contentType: 'image',
        language: Language.ENGLISH,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.cdnUrl).toContain('test-cdn.com');
    });

    it('should handle retrieval error', async () => {
      mockS3Send.mockRejectedValue(new Error('Object not found'));

      const result = await service.retrieveContent({
        siteId: 'site-123',
        contentType: 'image',
        language: Language.ENGLISH,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Object not found');
    });

    it('should retrieve with version', async () => {
      const mockStream = {
        on: jest.fn(function(this: any, event: string, handler: any) {
          if (event === 'data') {
            handler(Buffer.from('test'));
          }
          if (event === 'end') {
            handler();
          }
          return this;
        }),
      };

      mockS3Send.mockResolvedValue({
        Body: mockStream,
        Metadata: {},
      });

      const result = await service.retrieveContent({
        siteId: 'site-123',
        contentType: 'image',
        language: Language.ENGLISH,
        version: '2.0',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('deleteContent', () => {
    it('should delete content successfully', async () => {
      mockS3Send.mockResolvedValue({});

      const result = await service.deleteContent(
        'site-123',
        'artifact-456',
        'image',
        Language.ENGLISH
      );

      expect(result.success).toBe(true);
      expect(mockS3Send).toHaveBeenCalled();
    });

    it('should handle deletion error', async () => {
      mockS3Send.mockRejectedValue(new Error('Delete failed'));

      const result = await service.deleteContent(
        'site-123',
        'artifact-456',
        'image',
        Language.ENGLISH
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });

    it('should delete site-level content', async () => {
      mockS3Send.mockResolvedValue({});

      const result = await service.deleteContent(
        'site-123',
        undefined,
        'image',
        Language.HINDI
      );

      expect(result.success).toBe(true);
    });
  });

  describe('listContent', () => {
    it('should list content for a site', async () => {
      mockS3Send
        .mockResolvedValueOnce({
          Contents: [
            {
              Key: 'sites/site-123/image/english/1.0-123456',
              Size: 1024,
              LastModified: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          Metadata: {
            siteId: 'site-123',
            contentType: 'image',
            language: 'english',
          },
          ContentType: 'image/jpeg',
        });

      const result = await service.listContent('site-123');

      expect(result.success).toBe(true);
      expect(result.contents).toBeDefined();
      expect(result.contents?.length).toBeGreaterThan(0);
    });

    it('should list content for an artifact', async () => {
      mockS3Send
        .mockResolvedValueOnce({
          Contents: [
            {
              Key: 'sites/site-123/artifacts/artifact-456/video/hindi/1.0-123456',
              Size: 2048,
              LastModified: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          Metadata: {
            siteId: 'site-123',
            artifactId: 'artifact-456',
            contentType: 'video',
            language: 'hindi',
          },
          ContentType: 'video/mp4',
        });

      const result = await service.listContent('site-123', 'artifact-456');

      expect(result.success).toBe(true);
      expect(result.contents).toBeDefined();
    });

    it('should filter by content type', async () => {
      mockS3Send
        .mockResolvedValueOnce({
          Contents: [
            {
              Key: 'sites/site-123/image/english/1.0-123456',
              Size: 1024,
              LastModified: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          Metadata: {
            contentType: 'image',
          },
          ContentType: 'image/jpeg',
        });

      const result = await service.listContent('site-123', undefined, 'image');

      expect(result.success).toBe(true);
    });

    it('should handle empty list', async () => {
      mockS3Send.mockResolvedValue({
        Contents: [],
      });

      const result = await service.listContent('site-123');

      expect(result.success).toBe(true);
      expect(result.contents).toEqual([]);
    });

    it('should handle listing error', async () => {
      mockS3Send.mockRejectedValue(new Error('List failed'));

      const result = await service.listContent('site-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('List failed');
    });
  });

  describe('generatePresignedUrl', () => {
    it('should generate presigned URL', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockResolvedValue('https://presigned-url.com');

      const result = await service.generatePresignedUrl(
        'site-123',
        'artifact-456',
        'image',
        Language.ENGLISH
      );

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://presigned-url.com');
    });

    it('should use custom expiration', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockResolvedValue('https://presigned-url.com');

      const result = await service.generatePresignedUrl(
        'site-123',
        undefined,
        'video',
        Language.HINDI,
        7200
      );

      expect(result.success).toBe(true);
    });

    it('should handle presigned URL error', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockRejectedValue(new Error('Presign failed'));

      const result = await service.generatePresignedUrl(
        'site-123',
        'artifact-456',
        'image',
        Language.ENGLISH
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Presign failed');
    });
  });

  describe('copyContent', () => {
    it('should copy content successfully', async () => {
      mockS3Send.mockResolvedValue({});

      const result = await service.copyContent(
        'site-123',
        'artifact-456',
        'image',
        Language.ENGLISH,
        'site-789',
        'artifact-101',
        'image',
        Language.HINDI
      );

      expect(result.success).toBe(true);
      expect(mockS3Send).toHaveBeenCalled();
    });

    it('should handle copy error', async () => {
      mockS3Send.mockRejectedValue(new Error('Copy failed'));

      const result = await service.copyContent(
        'site-123',
        'artifact-456',
        'image',
        Language.ENGLISH,
        'site-789',
        'artifact-101',
        'image',
        Language.HINDI
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Copy failed');
    });

    it('should copy site-level content', async () => {
      mockS3Send.mockResolvedValue({});

      const result = await service.copyContent(
        'site-123',
        undefined,
        'image',
        Language.ENGLISH,
        'site-789',
        undefined,
        'image',
        Language.HINDI
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getCdnUrl', () => {
    it('should generate CDN URL for artifact content', () => {
      const url = service.getCdnUrl('site-123', 'artifact-456', 'image', Language.ENGLISH);

      expect(url).toContain('test-cdn.com');
      expect(url).toContain('site-123');
      expect(url).toContain('artifact-456');
      expect(url).toContain('image');
      expect(url).toContain('en');
    });

    it('should generate CDN URL for site content', () => {
      const url = service.getCdnUrl('site-123', undefined, 'video', Language.HINDI);

      expect(url).toContain('test-cdn.com');
      expect(url).toContain('site-123');
      expect(url).toContain('video');
      expect(url).toContain('hi');
    });
  });

  describe('Validation Methods', () => {
    it('should validate supported content types', () => {
      expect(service.isContentTypeSupported('image')).toBe(true);
      expect(service.isContentTypeSupported('video')).toBe(true);
      expect(service.isContentTypeSupported('audio')).toBe(true);
      expect(service.isContentTypeSupported('infographic')).toBe(true);
      expect(service.isContentTypeSupported('document')).toBe(true);
      expect(service.isContentTypeSupported('thumbnail')).toBe(true);
      expect(service.isContentTypeSupported('subtitle')).toBe(true);
      expect(service.isContentTypeSupported('invalid')).toBe(false);
    });

    it('should get list of supported content types', () => {
      const types = service.getSupportedContentTypes();

      expect(types).toContain('image');
      expect(types).toContain('video');
      expect(types).toContain('audio');
      expect(types).toContain('infographic');
      expect(types).toContain('document');
      expect(types).toContain('thumbnail');
      expect(types).toContain('subtitle');
      expect(types.length).toBe(7);
    });
  });
});
