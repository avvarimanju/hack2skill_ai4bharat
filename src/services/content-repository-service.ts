// Content Repository Service for S3 and CloudFront
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Language } from '../models/common';
import { logger } from '../utils/logger';

export interface ContentUploadRequest {
  siteId: string;
  artifactId?: string;
  contentType: ContentType;
  language: Language;
  data: Buffer | string;
  mimeType: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

export interface ContentUploadResult {
  success: boolean;
  contentUrl?: string;
  cdnUrl?: string;
  s3Key?: string;
  error?: string;
}

export interface ContentRetrievalRequest {
  siteId: string;
  artifactId?: string;
  contentType: ContentType;
  language: Language;
  version?: string;
}

export interface ContentRetrievalResult {
  success: boolean;
  data?: Buffer;
  contentUrl?: string;
  cdnUrl?: string;
  metadata?: Record<string, string>;
  error?: string;
}

export type ContentType =
  | 'image'
  | 'video'
  | 'audio'
  | 'infographic'
  | 'document'
  | 'thumbnail'
  | 'subtitle';

export interface ContentMetadata {
  siteId: string;
  artifactId?: string;
  contentType: ContentType;
  language: Language;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  version: string;
  customMetadata?: Record<string, string>;
}

export class ContentRepositoryService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly cloudFrontDomain: string;
  private readonly defaultCacheControl: string;

  constructor(
    bucketName?: string,
    cloudFrontDomain?: string,
    region: string = 'ap-south-1'
  ) {
    this.s3Client = new S3Client({ region });
    this.bucketName = bucketName || process.env.CONTENT_BUCKET_NAME || 'avvari-content';
    this.cloudFrontDomain =
      cloudFrontDomain || process.env.CLOUDFRONT_DOMAIN || 'cdn.avvari.com';
    this.defaultCacheControl = 'public, max-age=31536000, immutable';

    logger.info('Content repository service initialized', {
      bucket: this.bucketName,
      cloudFront: this.cloudFrontDomain,
    });
  }

  /**
   * Upload content to S3
   */
  public async uploadContent(
    request: ContentUploadRequest
  ): Promise<ContentUploadResult> {
    logger.info('Uploading content', {
      siteId: request.siteId,
      artifactId: request.artifactId,
      contentType: request.contentType,
      language: request.language,
    });

    try {
      // Validate request
      if (!request.siteId) {
        return {
          success: false,
          error: 'Site ID is required',
        };
      }

      if (!request.data) {
        return {
          success: false,
          error: 'Content data is required',
        };
      }

      // Generate S3 key
      const s3Key = this.generateS3Key(
        request.siteId,
        request.artifactId,
        request.contentType,
        request.language
      );

      // Prepare metadata
      const metadata: Record<string, string> = {
        siteId: request.siteId,
        contentType: request.contentType,
        language: request.language,
        uploadedAt: new Date().toISOString(),
        ...(request.artifactId && { artifactId: request.artifactId }),
        ...(request.metadata || {}),
      };

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: request.data,
        ContentType: request.mimeType,
        Metadata: metadata,
        CacheControl: request.cacheControl || this.defaultCacheControl,
      });

      await this.s3Client.send(command);

      // Generate URLs
      const s3Url = `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;
      const cdnUrl = `https://${this.cloudFrontDomain}/${s3Key}`;

      logger.info('Content uploaded successfully', {
        s3Key,
        cdnUrl,
      });

      return {
        success: true,
        contentUrl: s3Url,
        cdnUrl,
        s3Key,
      };
    } catch (error) {
      logger.error('Content upload failed', {
        error: error instanceof Error ? error.message : String(error),
        siteId: request.siteId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Content upload failed',
      };
    }
  }

  /**
   * Retrieve content from S3
   */
  public async retrieveContent(
    request: ContentRetrievalRequest
  ): Promise<ContentRetrievalResult> {
    logger.info('Retrieving content', {
      siteId: request.siteId,
      artifactId: request.artifactId,
      contentType: request.contentType,
      language: request.language,
    });

    try {
      // Generate S3 key
      const s3Key = this.generateS3Key(
        request.siteId,
        request.artifactId,
        request.contentType,
        request.language,
        request.version
      );

      // Get object from S3
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.s3Client.send(command);

      // Read data
      const data = await this.streamToBuffer(response.Body as any);

      // Generate URLs
      const s3Url = `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;
      const cdnUrl = `https://${this.cloudFrontDomain}/${s3Key}`;

      return {
        success: true,
        data,
        contentUrl: s3Url,
        cdnUrl,
        metadata: response.Metadata,
      };
    } catch (error) {
      logger.error('Content retrieval failed', {
        error: error instanceof Error ? error.message : String(error),
        siteId: request.siteId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Content retrieval failed',
      };
    }
  }

  /**
   * Delete content from S3
   */
  public async deleteContent(
    siteId: string,
    artifactId: string | undefined,
    contentType: ContentType,
    language: Language
  ): Promise<{ success: boolean; error?: string }> {
    logger.info('Deleting content', {
      siteId,
      artifactId,
      contentType,
      language,
    });

    try {
      const s3Key = this.generateS3Key(siteId, artifactId, contentType, language);

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.s3Client.send(command);

      logger.info('Content deleted successfully', { s3Key });

      return { success: true };
    } catch (error) {
      logger.error('Content deletion failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Content deletion failed',
      };
    }
  }

  /**
   * List content for a site or artifact
   */
  public async listContent(
    siteId: string,
    artifactId?: string,
    contentType?: ContentType
  ): Promise<{ success: boolean; contents?: ContentMetadata[]; error?: string }> {
    logger.info('Listing content', { siteId, artifactId, contentType });

    try {
      const prefix = artifactId
        ? `sites/${siteId}/artifacts/${artifactId}/`
        : `sites/${siteId}/`;

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);

      const contents: ContentMetadata[] = [];

      if (response.Contents) {
        for (const item of response.Contents) {
          if (!item.Key) continue;

          // Get metadata
          const headCommand = new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: item.Key,
          });

          const headResponse = await this.s3Client.send(headCommand);

          const metadata: ContentMetadata = {
            siteId: headResponse.Metadata?.siteId || siteId,
            artifactId: headResponse.Metadata?.artifactId,
            contentType: (headResponse.Metadata?.contentType as ContentType) || 'document',
            language: (headResponse.Metadata?.language as Language) || Language.ENGLISH,
            mimeType: headResponse.ContentType || 'application/octet-stream',
            size: item.Size || 0,
            uploadedAt: item.LastModified || new Date(),
            version: headResponse.Metadata?.version || '1.0',
            customMetadata: headResponse.Metadata,
          };

          // Filter by content type if specified
          if (!contentType || metadata.contentType === contentType) {
            contents.push(metadata);
          }
        }
      }

      return {
        success: true,
        contents,
      };
    } catch (error) {
      logger.error('Content listing failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Content listing failed',
      };
    }
  }

  /**
   * Generate presigned URL for temporary access
   */
  public async generatePresignedUrl(
    siteId: string,
    artifactId: string | undefined,
    contentType: ContentType,
    language: Language,
    expiresIn: number = 3600
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const s3Key = this.generateS3Key(siteId, artifactId, contentType, language);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      return {
        success: true,
        url,
      };
    } catch (error) {
      logger.error('Presigned URL generation failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Presigned URL generation failed',
      };
    }
  }

  /**
   * Copy content to a new location
   */
  public async copyContent(
    sourceSiteId: string,
    sourceArtifactId: string | undefined,
    sourceContentType: ContentType,
    sourceLanguage: Language,
    targetSiteId: string,
    targetArtifactId: string | undefined,
    targetContentType: ContentType,
    targetLanguage: Language
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const sourceKey = this.generateS3Key(
        sourceSiteId,
        sourceArtifactId,
        sourceContentType,
        sourceLanguage
      );
      const targetKey = this.generateS3Key(
        targetSiteId,
        targetArtifactId,
        targetContentType,
        targetLanguage
      );

      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: targetKey,
      });

      await this.s3Client.send(command);

      logger.info('Content copied successfully', {
        sourceKey,
        targetKey,
      });

      return { success: true };
    } catch (error) {
      logger.error('Content copy failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Content copy failed',
      };
    }
  }

  /**
   * Get CDN URL for content
   */
  public getCdnUrl(
    siteId: string,
    artifactId: string | undefined,
    contentType: ContentType,
    language: Language
  ): string {
    const s3Key = this.generateS3Key(siteId, artifactId, contentType, language);
    return `https://${this.cloudFrontDomain}/${s3Key}`;
  }

  /**
   * Generate S3 key based on content organization structure
   */
  private generateS3Key(
    siteId: string,
    artifactId: string | undefined,
    contentType: ContentType,
    language: Language,
    version?: string
  ): string {
    const timestamp = Date.now();
    const versionStr = version || '1.0';
    const languageCode = language.toLowerCase();

    if (artifactId) {
      return `sites/${siteId}/artifacts/${artifactId}/${contentType}/${languageCode}/${versionStr}-${timestamp}`;
    } else {
      return `sites/${siteId}/${contentType}/${languageCode}/${versionStr}-${timestamp}`;
    }
  }

  /**
   * Convert stream to buffer
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Get supported content types
   */
  public getSupportedContentTypes(): ContentType[] {
    return ['image', 'video', 'audio', 'infographic', 'document', 'thumbnail', 'subtitle'];
  }

  /**
   * Validate content type
   */
  public isContentTypeSupported(type: string): type is ContentType {
    return this.getSupportedContentTypes().includes(type as ContentType);
  }
}
