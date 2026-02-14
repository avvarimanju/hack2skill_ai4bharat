import {
  HeritageSite,
  ArtifactReference,
  Language,
  ArtifactType,
  GeoCoordinates,
  RelativeCoordinates,
  ValidationResult,
} from '../models/common';
import { HeritageSitesRepository } from '../repositories/heritage-sites-repository';
import { logger } from '../utils/logger';

/**
 * Site Management Service
 * Handles creation, updates, and management of heritage sites
 */

export interface SiteCreationRequest {
  name: string;
  location: GeoCoordinates;
  description: string;
  historicalPeriod: string;
  culturalSignificance: string;
  supportedLanguages: Language[];
  curator: string;
  tags?: string[];
}

export interface ArtifactCreationRequest {
  name: string;
  type: ArtifactType;
  location: RelativeCoordinates;
  description: string;
  qrCodeData?: string;
}

export interface BulkSiteUpdate {
  siteId: string;
  updates: Partial<HeritageSite>;
}

export interface SiteManagementStats {
  totalSites: number;
  activeSites: number;
  inactiveSites: number;
  maintenanceSites: number;
  totalArtifacts: number;
  languageCoverage: Record<Language, number>;
}

export class SiteManagementService {
  private sitesRepository: HeritageSitesRepository;

  constructor(sitesRepository: HeritageSitesRepository) {
    this.sitesRepository = sitesRepository;
    logger.info('Site management service initialized');
  }

  /**
   * Create a new heritage site
   */
  public async createSite(request: SiteCreationRequest): Promise<HeritageSite> {
    logger.info('Creating new heritage site', { name: request.name });

    // Generate site ID
    const siteId = this.generateSiteId(request.name);

    // Create site object
    const site: HeritageSite = {
      siteId,
      name: request.name,
      location: request.location,
      description: request.description,
      historicalPeriod: request.historicalPeriod,
      culturalSignificance: request.culturalSignificance,
      artifacts: [],
      supportedLanguages: request.supportedLanguages,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        curator: request.curator,
        tags: request.tags || [],
        status: 'active',
      },
    };

    // Validate site
    const validation = this.validateSite(site);
    if (!validation.isValid) {
      throw new Error(`Site validation failed: ${validation.errors?.join(', ')}`);
    }

    // Save to repository
    await this.sitesRepository.create(site);

    logger.info('Heritage site created successfully', { siteId });
    return site;
  }

  /**
   * Add artifact to a site
   */
  public async addArtifact(
    siteId: string,
    artifact: ArtifactCreationRequest
  ): Promise<HeritageSite> {
    logger.info('Adding artifact to site', { siteId, artifactName: artifact.name });

    // Generate artifact ID
    const artifactId = this.generateArtifactId(siteId, artifact.name);

    // Generate QR code data if not provided
    const qrCodeData = artifact.qrCodeData || this.generateQRCodeData(siteId, artifactId);

    // Create artifact reference
    const artifactRef: ArtifactReference = {
      artifactId,
      name: artifact.name,
      type: artifact.type,
      location: artifact.location,
      qrCodeData,
      description: artifact.description,
    };

    // Add to repository
    const updatedSite = await this.sitesRepository.addArtifact(siteId, artifactRef);
    if (!updatedSite) {
      throw new Error(`Site not found: ${siteId}`);
    }

    logger.info('Artifact added successfully', { siteId, artifactId });
    return updatedSite;
  }

  /**
   * Remove artifact from a site
   */
  public async removeArtifact(siteId: string, artifactId: string): Promise<HeritageSite> {
    logger.info('Removing artifact from site', { siteId, artifactId });

    const updatedSite = await this.sitesRepository.removeArtifact(siteId, artifactId);
    if (!updatedSite) {
      throw new Error(`Site or artifact not found: ${siteId}/${artifactId}`);
    }

    logger.info('Artifact removed successfully', { siteId, artifactId });
    return updatedSite;
  }

  /**
   * Update artifact information
   */
  public async updateArtifact(
    siteId: string,
    artifactId: string,
    updates: Partial<ArtifactReference>
  ): Promise<HeritageSite> {
    logger.info('Updating artifact', { siteId, artifactId });

    const updatedSite = await this.sitesRepository.updateArtifact(siteId, artifactId, updates);
    if (!updatedSite) {
      throw new Error(`Site or artifact not found: ${siteId}/${artifactId}`);
    }

    logger.info('Artifact updated successfully', { siteId, artifactId });
    return updatedSite;
  }

  /**
   * Update site information
   */
  public async updateSite(
    siteId: string,
    updates: Partial<HeritageSite>
  ): Promise<HeritageSite> {
    logger.info('Updating site', { siteId });

    const updatedSite = await this.sitesRepository.updateSite(siteId, updates);
    if (!updatedSite) {
      throw new Error(`Site not found: ${siteId}`);
    }

    logger.info('Site updated successfully', { siteId });
    return updatedSite;
  }

  /**
   * Bulk update multiple sites
   */
  public async bulkUpdateSites(updates: BulkSiteUpdate[]): Promise<{
    successful: string[];
    failed: Array<{ siteId: string; error: string }>;
  }> {
    logger.info('Performing bulk site updates', { count: updates.length });

    const successful: string[] = [];
    const failed: Array<{ siteId: string; error: string }> = [];

    // Process updates individually to track success/failure
    for (const update of updates) {
      try {
        await this.sitesRepository.updateSite(update.siteId, update.updates);
        successful.push(update.siteId);
      } catch (error) {
        failed.push({
          siteId: update.siteId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Bulk update completed', {
      successful: successful.length,
      failed: failed.length,
    });

    return { successful, failed };
  }

  /**
   * Get site by ID
   */
  public async getSite(siteId: string): Promise<HeritageSite | null> {
    return this.sitesRepository.getBySiteId(siteId);
  }

  /**
   * Get all sites
   */
  public async getAllSites(): Promise<HeritageSite[]> {
    return this.sitesRepository.getAllSites();
  }

  /**
   * Get sites by status
   */
  public async getSitesByStatus(
    status: 'active' | 'inactive' | 'maintenance'
  ): Promise<HeritageSite[]> {
    return this.sitesRepository.getSitesByStatus(status);
  }

  /**
   * Search sites by name or description
   */
  public async searchSites(searchTerm: string): Promise<HeritageSite[]> {
    return this.sitesRepository.searchSites(searchTerm);
  }

  /**
   * Get sites by language support
   */
  public async getSitesByLanguage(language: Language): Promise<HeritageSite[]> {
    return this.sitesRepository.getSitesByLanguage(language);
  }

  /**
   * Get sites near a location
   */
  public async getSitesNearLocation(
    location: GeoCoordinates,
    radiusKm: number
  ): Promise<HeritageSite[]> {
    return this.sitesRepository.getSitesByProximity(
      location.latitude,
      location.longitude,
      radiusKm
    );
  }

  /**
   * Delete a site
   */
  public async deleteSite(siteId: string): Promise<HeritageSite> {
    logger.info('Deleting site', { siteId });

    const deletedSite = await this.sitesRepository.deleteSite(siteId);
    if (!deletedSite) {
      throw new Error(`Site not found: ${siteId}`);
    }

    logger.info('Site deleted successfully', { siteId });
    return deletedSite;
  }

  /**
   * Get management statistics
   */
  public async getManagementStats(): Promise<SiteManagementStats> {
    const allSites = await this.sitesRepository.getAllSites();

    const stats: SiteManagementStats = {
      totalSites: allSites.length,
      activeSites: allSites.filter(s => s.metadata.status === 'active').length,
      inactiveSites: allSites.filter(s => s.metadata.status === 'inactive').length,
      maintenanceSites: allSites.filter(s => s.metadata.status === 'maintenance').length,
      totalArtifacts: allSites.reduce((sum, site) => sum + site.artifacts.length, 0),
      languageCoverage: {} as Record<Language, number>,
    };

    // Calculate language coverage
    Object.values(Language).forEach(lang => {
      stats.languageCoverage[lang] = allSites.filter(s =>
        s.supportedLanguages.includes(lang)
      ).length;
    });

    return stats;
  }

  /**
   * Validate site data
   */
  private validateSite(site: HeritageSite): ValidationResult {
    const errors: string[] = [];

    if (!site.siteId || site.siteId.trim() === '') {
      errors.push('Site ID is required');
    }

    if (!site.name || site.name.trim() === '') {
      errors.push('Site name is required');
    }

    if (!site.location || typeof site.location.latitude !== 'number' || typeof site.location.longitude !== 'number') {
      errors.push('Valid location coordinates are required');
    }

    if (!site.description || site.description.trim() === '') {
      errors.push('Site description is required');
    }

    if (!site.supportedLanguages || site.supportedLanguages.length === 0) {
      errors.push('At least one supported language is required');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate site ID from name
   */
  private generateSiteId(name: string): string {
    const normalized = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const timestamp = Date.now().toString(36);
    return `${normalized}-${timestamp}`;
  }

  /**
   * Generate artifact ID
   */
  private generateArtifactId(siteId: string, artifactName: string): string {
    const normalized = artifactName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const timestamp = Date.now().toString(36);
    return `${siteId}-${normalized}-${timestamp}`;
  }

  /**
   * Generate QR code data
   */
  private generateQRCodeData(siteId: string, artifactId: string): string {
    return JSON.stringify({
      siteId,
      artifactId,
      version: '1.0',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get service status
   */
  public getStatus(): { healthy: boolean; stats: any } {
    const cacheStats = this.sitesRepository.getHeritageSiteCacheStats();
    return {
      healthy: true,
      stats: {
        cacheSize: cacheStats.size,
        cacheHitRate: cacheStats.hitRate,
      },
    };
  }
}

/**
 * Factory function to create SiteManagementService
 */
export function createSiteManagementService(
  sitesRepository: HeritageSitesRepository
): SiteManagementService {
  return new SiteManagementService(sitesRepository);
}
