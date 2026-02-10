// QR Code Processing Service
import { ArtifactIdentifier, QRScanRequest, ValidationResult } from '../models/common';
import { validateQrScanRequest, validateArtifactIdentifier } from '../utils/validation';
import { RepositoryFactory } from '../repositories';
import { logger } from '../utils/logger';

export interface QRProcessingResult {
  success: boolean;
  artifactIdentifier?: ArtifactIdentifier;
  artifactMetadata?: any;
  siteMetadata?: any;
  error?: string;
  validationErrors?: string[];
}

export class QRProcessingService {
  private artifactsRepository = RepositoryFactory.getArtifactsRepository();
  private heritageSitesRepository = RepositoryFactory.getHeritageSitesRepository();

  /**
   * Process QR code scan request
   */
  public async processQRScan(request: QRScanRequest): Promise<QRProcessingResult> {
    logger.info('Processing QR scan request', { 
      hasQRData: !!request.qrData,
      sessionId: request.sessionId,
      hasLocation: !!request.location 
    });

    // Validate request
    const validation = this.validateQRScanRequest(request);
    if (!validation.isValid) {
      logger.warn('QR scan request validation failed', { errors: validation.errors });
      return {
        success: false,
        error: 'Invalid QR scan request',
        validationErrors: validation.errors,
      };
    }

    try {
      // Decode QR data to extract artifact identifier
      const artifactIdentifier = this.decodeQRData(request.qrData);
      
      if (!artifactIdentifier) {
        logger.warn('Failed to decode QR data', { qrData: request.qrData });
        return {
          success: false,
          error: 'Invalid QR code format',
        };
      }

      // Validate artifact identifier
      const identifierValidation = this.validateArtifactIdentifier(artifactIdentifier);
      if (!identifierValidation.isValid) {
        logger.warn('Artifact identifier validation failed', { 
          errors: identifierValidation.errors,
          artifactIdentifier 
        });
        return {
          success: false,
          error: 'Invalid artifact identifier',
          validationErrors: identifierValidation.errors,
        };
      }

      // Fetch artifact metadata
      const artifactMetadata = await this.artifactsRepository.getByArtifactId(
        artifactIdentifier.artifactId,
        artifactIdentifier.siteId
      );

      if (!artifactMetadata) {
        logger.warn('Artifact not found', { 
          artifactId: artifactIdentifier.artifactId,
          siteId: artifactIdentifier.siteId 
        });
        return {
          success: false,
          error: 'Artifact not found in database',
          artifactIdentifier,
        };
      }

      // Fetch site metadata
      const siteMetadata = await this.heritageSitesRepository.getBySiteId(
        artifactIdentifier.siteId
      );

      if (!siteMetadata) {
        logger.warn('Heritage site not found', { siteId: artifactIdentifier.siteId });
        return {
          success: false,
          error: 'Heritage site not found in database',
          artifactIdentifier,
          artifactMetadata,
        };
      }

      // Verify location if provided
      if (request.location && siteMetadata.location) {
        const isNearby = this.verifyLocation(
          request.location,
          siteMetadata.location,
          1.0 // 1 km radius
        );

        if (!isNearby) {
          logger.warn('User location too far from site', {
            userLocation: request.location,
            siteLocation: siteMetadata.location,
          });
          // Don't fail, just log warning - user might be viewing remotely
        }
      }

      logger.info('QR scan processed successfully', {
        artifactId: artifactIdentifier.artifactId,
        siteId: artifactIdentifier.siteId,
        artifactName: artifactMetadata.name,
        siteName: siteMetadata.name,
      });

      return {
        success: true,
        artifactIdentifier,
        artifactMetadata,
        siteMetadata,
      };
    } catch (error) {
      logger.error('Error processing QR scan', {
        error: error instanceof Error ? error.message : String(error),
        qrData: request.qrData,
      });

      return {
        success: false,
        error: 'Internal error processing QR code',
      };
    }
  }

  /**
   * Decode QR data to extract artifact identifier
   */
  private decodeQRData(qrData: string): ArtifactIdentifier | null {
    try {
      // QR data format: avvari://{siteId}/{artifactId}?timestamp={timestamp}
      // or JSON format: {"siteId": "...", "artifactId": "...", "timestamp": "..."}
      
      // Try JSON format first
      if (qrData.startsWith('{')) {
        const parsed = JSON.parse(qrData);
        return {
          siteId: parsed.siteId,
          artifactId: parsed.artifactId,
          timestamp: parsed.timestamp || new Date().toISOString(),
          location: parsed.location,
        };
      }

      // Try URI format
      if (qrData.startsWith('avvari://')) {
        const url = new URL(qrData);
        // In URL format, hostname is siteId and pathname contains artifactId
        const siteId = url.hostname;
        const pathParts = url.pathname.split('/').filter(p => p);
        
        if (!siteId || pathParts.length < 1) {
          return null;
        }

        const timestamp = url.searchParams.get('timestamp') || new Date().toISOString();
        const lat = url.searchParams.get('lat');
        const lon = url.searchParams.get('lon');

        return {
          siteId,
          artifactId: pathParts[0],
          timestamp,
          location: lat && lon ? {
            latitude: parseFloat(lat),
            longitude: parseFloat(lon),
          } : undefined,
        };
      }

      // Try simple format: siteId:artifactId
      if (qrData.includes(':')) {
        const parts = qrData.split(':');
        if (parts.length >= 2) {
          return {
            siteId: parts[0],
            artifactId: parts[1],
            timestamp: new Date().toISOString(),
          };
        }
      }

      logger.warn('Unrecognized QR data format', { qrData });
      return null;
    } catch (error) {
      logger.error('Error decoding QR data', {
        error: error instanceof Error ? error.message : String(error),
        qrData,
      });
      return null;
    }
  }

  /**
   * Validate QR scan request
   */
  private validateQRScanRequest(request: QRScanRequest): ValidationResult {
    const result = validateQrScanRequest(request);
    if (result.success) {
      return { isValid: true };
    }
    return { isValid: false, errors: result.errors };
  }

  /**
   * Validate artifact identifier
   */
  private validateArtifactIdentifier(identifier: ArtifactIdentifier): ValidationResult {
    const result = validateArtifactIdentifier(identifier);
    if (result.success) {
      return { isValid: true };
    }
    return { isValid: false, errors: result.errors };
  }

  /**
   * Verify user location is near the heritage site
   */
  private verifyLocation(
    userLocation: { latitude: number; longitude: number },
    siteLocation: { latitude: number; longitude: number },
    radiusKm: number
  ): boolean {
    const distance = this.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      siteLocation.latitude,
      siteLocation.longitude
    );

    return distance <= radiusKm;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Validate QR code format and integrity
   */
  public validateQRCodeFormat(qrData: string): {
    isValid: boolean;
    format?: 'json' | 'uri' | 'simple';
    error?: string;
  } {
    if (!qrData || qrData.trim().length === 0) {
      return { isValid: false, error: 'QR data is empty' };
    }

    // Check JSON format
    if (qrData.startsWith('{')) {
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.siteId && parsed.artifactId) {
          return { isValid: true, format: 'json' };
        }
        return { isValid: false, error: 'JSON missing required fields' };
      } catch {
        return { isValid: false, error: 'Invalid JSON format' };
      }
    }

    // Check URI format
    if (qrData.startsWith('avvari://')) {
      try {
        const url = new URL(qrData);
        // In URL format, hostname is siteId and pathname contains artifactId
        const siteId = url.hostname;
        const pathParts = url.pathname.split('/').filter(p => p);
        if (siteId && pathParts.length >= 1) {
          return { isValid: true, format: 'uri' };
        }
        return { isValid: false, error: 'URI missing required path components' };
      } catch {
        return { isValid: false, error: 'Invalid URI format' };
      }
    }

    // Check simple format
    if (qrData.includes(':')) {
      const parts = qrData.split(':');
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return { isValid: true, format: 'simple' };
      }
      return { isValid: false, error: 'Simple format missing required components' };
    }

    return { isValid: false, error: 'Unrecognized QR code format' };
  }

  /**
   * Check if QR code is corrupted
   */
  public isQRCodeCorrupted(qrData: string): boolean {
    // Check for common corruption indicators
    const corruptionIndicators = [
      qrData.includes('\0'), // Null bytes
      qrData.includes('�'), // Replacement character
      qrData.length < 10, // Too short
      qrData.length > 1000, // Too long
      /[^\x20-\x7E\n\r\t]/.test(qrData) && !qrData.startsWith('{'), // Non-printable chars (except in JSON)
    ];

    return corruptionIndicators.some(indicator => indicator);
  }

  /**
   * Generate QR code data for an artifact
   */
  public generateQRCodeData(
    siteId: string,
    artifactId: string,
    format: 'json' | 'uri' | 'simple' = 'uri'
  ): string {
    const timestamp = new Date().toISOString();

    switch (format) {
      case 'json':
        return JSON.stringify({
          siteId,
          artifactId,
          timestamp,
        });

      case 'uri':
        return `avvari://${siteId}/${artifactId}?timestamp=${encodeURIComponent(timestamp)}`;

      case 'simple':
        return `${siteId}:${artifactId}`;

      default:
        throw new Error(`Unsupported QR code format: ${format}`);
    }
  }
}
