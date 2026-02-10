// Heritage Sites repository for DynamoDB operations
import { BaseRepository } from './base-repository';
import { HeritageSite, ValidationResult, Language, ArtifactReference } from '../models/common';
import { validateHeritageSite } from '../utils/validation';
import { TABLES } from '../utils/aws-clients';
import { logger } from '../utils/logger';

export class HeritageSitesRepository extends BaseRepository<HeritageSite> {
  constructor() {
    super(
      TABLES.HERITAGE_SITES,
      {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
      },
      true, // Enable caching
      600000 // 10 minutes cache TTL for heritage sites
    );
  }

  protected validateEntity(site: HeritageSite): ValidationResult {
    const result = validateHeritageSite(site);
    if (result.success) {
      return { isValid: true };
    }
    return { isValid: false, errors: result.errors };
  }

  protected getPrimaryKey(site: HeritageSite): Record<string, any> {
    return { siteId: site.siteId };
  }

  protected getCacheKey(key: Record<string, any>): string {
    return `heritage-site:${key.siteId}`;
  }

  /**
   * Get heritage site by ID
   */
  public async getBySiteId(siteId: string): Promise<HeritageSite | null> {
    logger.debug('Getting heritage site by ID', { siteId });
    return await this.get({ siteId });
  }

  /**
   * Create new heritage site
   */
  public async create(site: HeritageSite): Promise<void> {
    logger.info('Creating new heritage site', { siteId: site.siteId, name: site.name });
    
    // Ensure timestamps are set
    const now = new Date().toISOString();
    site.metadata.createdAt = now;
    site.metadata.updatedAt = now;
    
    await this.put(site, { overwrite: false });
  }

  /**
   * Update heritage site
   */
  public async updateSite(
    siteId: string,
    updates: Partial<Omit<HeritageSite, 'siteId' | 'metadata'>> & {
      metadata?: Partial<HeritageSite['metadata']>;
    }
  ): Promise<HeritageSite | null> {
    logger.info('Updating heritage site', { siteId, updates: Object.keys(updates) });
    
    const updateData: Record<string, any> = {
      ...updates,
      'metadata.updatedAt': new Date().toISOString(),
    };

    // If metadata updates are provided, merge them
    if (updates.metadata) {
      for (const [key, value] of Object.entries(updates.metadata)) {
        updateData[`metadata.${key}`] = value;
      }
      delete updateData.metadata;
    }

    return await this.update({ siteId }, updateData);
  }

  /**
   * Delete heritage site
   */
  public async deleteSite(siteId: string): Promise<HeritageSite | null> {
    logger.info('Deleting heritage site', { siteId });
    return await this.delete({ siteId });
  }

  /**
   * Get all heritage sites
   */
  public async getAllSites(): Promise<HeritageSite[]> {
    logger.debug('Getting all heritage sites');
    return await this.scan();
  }

  /**
   * Get heritage sites by status
   */
  public async getSitesByStatus(status: 'active' | 'inactive' | 'maintenance'): Promise<HeritageSite[]> {
    logger.debug('Getting heritage sites by status', { status });
    
    return await this.scan({
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'metadata.status',
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
    });
  }

  /**
   * Get heritage sites that support a specific language
   */
  public async getSitesByLanguage(language: Language): Promise<HeritageSite[]> {
    logger.debug('Getting heritage sites by language', { language });
    
    return await this.scan({
      FilterExpression: 'contains(supportedLanguages, :language)',
      ExpressionAttributeValues: {
        ':language': language,
      },
    });
  }

  /**
   * Search heritage sites by name or description
   */
  public async searchSites(searchTerm: string): Promise<HeritageSite[]> {
    logger.debug('Searching heritage sites', { searchTerm });
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return await this.scan({
      FilterExpression: 'contains(#name, :searchTerm) OR contains(description, :searchTerm)',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ExpressionAttributeValues: {
        ':searchTerm': lowerSearchTerm,
      },
    });
  }

  /**
   * Add artifact to heritage site
   */
  public async addArtifact(siteId: string, artifact: ArtifactReference): Promise<HeritageSite | null> {
    logger.info('Adding artifact to heritage site', { siteId, artifactId: artifact.artifactId });
    
    // First get the current site to check if artifact already exists
    const currentSite = await this.getBySiteId(siteId);
    if (!currentSite) {
      throw new Error(`Heritage site not found: ${siteId}`);
    }

    // Check if artifact already exists
    const existingArtifact = currentSite.artifacts.find(a => a.artifactId === artifact.artifactId);
    if (existingArtifact) {
      throw new Error(`Artifact already exists in site: ${artifact.artifactId}`);
    }

    // Add the new artifact
    const updatedArtifacts = [...currentSite.artifacts, artifact];
    
    return await this.update(
      { siteId },
      {
        artifacts: updatedArtifacts,
        'metadata.updatedAt': new Date().toISOString(),
      }
    );
  }

  /**
   * Remove artifact from heritage site
   */
  public async removeArtifact(siteId: string, artifactId: string): Promise<HeritageSite | null> {
    logger.info('Removing artifact from heritage site', { siteId, artifactId });
    
    // First get the current site
    const currentSite = await this.getBySiteId(siteId);
    if (!currentSite) {
      throw new Error(`Heritage site not found: ${siteId}`);
    }

    // Filter out the artifact
    const updatedArtifacts = currentSite.artifacts.filter(a => a.artifactId !== artifactId);
    
    if (updatedArtifacts.length === currentSite.artifacts.length) {
      throw new Error(`Artifact not found in site: ${artifactId}`);
    }

    return await this.update(
      { siteId },
      {
        artifacts: updatedArtifacts,
        'metadata.updatedAt': new Date().toISOString(),
      }
    );
  }

  /**
   * Update artifact in heritage site
   */
  public async updateArtifact(
    siteId: string,
    artifactId: string,
    updates: Partial<ArtifactReference>
  ): Promise<HeritageSite | null> {
    logger.info('Updating artifact in heritage site', { siteId, artifactId, updates: Object.keys(updates) });
    
    // First get the current site
    const currentSite = await this.getBySiteId(siteId);
    if (!currentSite) {
      throw new Error(`Heritage site not found: ${siteId}`);
    }

    // Find and update the artifact
    const artifactIndex = currentSite.artifacts.findIndex(a => a.artifactId === artifactId);
    if (artifactIndex === -1) {
      throw new Error(`Artifact not found in site: ${artifactId}`);
    }

    const updatedArtifacts = [...currentSite.artifacts];
    updatedArtifacts[artifactIndex] = {
      ...updatedArtifacts[artifactIndex],
      ...updates,
    };

    return await this.update(
      { siteId },
      {
        artifacts: updatedArtifacts,
        'metadata.updatedAt': new Date().toISOString(),
      }
    );
  }

  /**
   * Get heritage sites by geographical proximity
   */
  public async getSitesByProximity(
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<HeritageSite[]> {
    logger.debug('Getting heritage sites by proximity', { latitude, longitude, radiusKm });
    
    // Get all sites and filter by distance
    // Note: For production, consider using DynamoDB's geospatial queries or a dedicated geospatial service
    const allSites = await this.getAllSites();
    
    return allSites.filter(site => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        site.location.latitude,
        site.location.longitude
      );
      return distance <= radiusKm;
    });
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get heritage sites with pagination
   */
  public async getSitesWithPagination(
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    sites: HeritageSite[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    logger.debug('Getting heritage sites with pagination', { limit, hasLastKey: !!lastEvaluatedKey });
    
    const result = await this.executeWithRetry(
      async () => {
        const command = new (await import('@aws-sdk/lib-dynamodb')).ScanCommand({
          TableName: this.tableName,
          Limit: limit,
          ExclusiveStartKey: lastEvaluatedKey,
        });
        return await (await import('../utils/aws-clients')).docClient.send(command);
      },
      'getSitesWithPagination',
      { limit }
    );

    return {
      sites: (result.Items as HeritageSite[]) || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Bulk update heritage sites
   */
  public async bulkUpdateSites(updates: Array<{
    siteId: string;
    updates: Partial<Omit<HeritageSite, 'siteId' | 'metadata'>> & {
      metadata?: Partial<HeritageSite['metadata']>;
    };
  }>): Promise<void> {
    logger.info('Bulk updating heritage sites', { count: updates.length });
    
    const promises = updates.map(({ siteId, updates: siteUpdates }) =>
      this.updateSite(siteId, siteUpdates)
    );
    
    await Promise.all(promises);
  }

  /**
   * Get cache statistics specific to heritage sites
   */
  public getHeritageSiteCacheStats(): { size: number; hitRate?: number } {
    return this.getCacheStats();
  }
}