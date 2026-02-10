// Artifacts repository for DynamoDB operations
import { BaseRepository } from './base-repository';
import { ArtifactMetadata, ValidationResult, ArtifactType } from '../models/common';
import { validateArtifactMetadata } from '../utils/validation';
import { TABLES } from '../utils/aws-clients';
import { logger } from '../utils/logger';

export class ArtifactsRepository extends BaseRepository<ArtifactMetadata> {
  constructor() {
    super(
      TABLES.ARTIFACTS,
      {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
      },
      true, // Enable caching
      300000 // 5 minutes cache TTL for artifacts
    );
  }

  protected validateEntity(artifact: ArtifactMetadata): ValidationResult {
    const result = validateArtifactMetadata(artifact);
    if (result.success) {
      return { isValid: true };
    }
    return { isValid: false, errors: result.errors };
  }

  protected getPrimaryKey(artifact: ArtifactMetadata): Record<string, any> {
    return { 
      artifactId: artifact.artifactId,
      siteId: artifact.siteId 
    };
  }

  protected getCacheKey(key: Record<string, any>): string {
    return `artifact:${key.siteId}:${key.artifactId}`;
  }

  /**
   * Get artifact by ID and site ID
   */
  public async getByArtifactId(artifactId: string, siteId: string): Promise<ArtifactMetadata | null> {
    logger.debug('Getting artifact by ID', { artifactId, siteId });
    return await this.get({ artifactId, siteId });
  }

  /**
   * Create new artifact
   */
  public async create(artifact: ArtifactMetadata): Promise<void> {
    logger.info('Creating new artifact', { 
      artifactId: artifact.artifactId, 
      siteId: artifact.siteId,
      name: artifact.name 
    });
    
    // Ensure timestamp is set
    artifact.lastUpdated = new Date().toISOString();
    
    await this.put(artifact, { overwrite: false });
  }

  /**
   * Update artifact
   */
  public async updateArtifact(
    artifactId: string,
    siteId: string,
    updates: Partial<Omit<ArtifactMetadata, 'artifactId' | 'siteId'>>
  ): Promise<ArtifactMetadata | null> {
    logger.info('Updating artifact', { artifactId, siteId, updates: Object.keys(updates) });
    
    const updateData = {
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    return await this.update({ artifactId, siteId }, updateData);
  }

  /**
   * Delete artifact
   */
  public async deleteArtifact(artifactId: string, siteId: string): Promise<ArtifactMetadata | null> {
    logger.info('Deleting artifact', { artifactId, siteId });
    return await this.delete({ artifactId, siteId });
  }

  /**
   * Get all artifacts for a heritage site
   */
  public async getArtifactsBySite(siteId: string): Promise<ArtifactMetadata[]> {
    logger.debug('Getting artifacts by site', { siteId });
    
    return await this.query({
      KeyConditionExpression: 'siteId = :siteId',
      ExpressionAttributeValues: {
        ':siteId': siteId,
      },
    });
  }

  /**
   * Get artifacts by type
   */
  public async getArtifactsByType(siteId: string, type: ArtifactType): Promise<ArtifactMetadata[]> {
    logger.debug('Getting artifacts by type', { siteId, type });
    
    return await this.query({
      KeyConditionExpression: 'siteId = :siteId',
      FilterExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type',
      },
      ExpressionAttributeValues: {
        ':siteId': siteId,
        ':type': type,
      },
    });
  }

  /**
   * Search artifacts by name or description within a site
   */
  public async searchArtifacts(siteId: string, searchTerm: string): Promise<ArtifactMetadata[]> {
    logger.debug('Searching artifacts', { siteId, searchTerm });
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return await this.query({
      KeyConditionExpression: 'siteId = :siteId',
      FilterExpression: 'contains(#name, :searchTerm) OR contains(description, :searchTerm) OR contains(historicalContext, :searchTerm)',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ExpressionAttributeValues: {
        ':siteId': siteId,
        ':searchTerm': lowerSearchTerm,
      },
    });
  }

  /**
   * Get artifacts by construction period
   */
  public async getArtifactsByPeriod(siteId: string, period: string): Promise<ArtifactMetadata[]> {
    logger.debug('Getting artifacts by construction period', { siteId, period });
    
    return await this.query({
      KeyConditionExpression: 'siteId = :siteId',
      FilterExpression: 'constructionPeriod = :period',
      ExpressionAttributeValues: {
        ':siteId': siteId,
        ':period': period,
      },
    });
  }

  /**
   * Get artifacts by conservation status
   */
  public async getArtifactsByConservationStatus(
    siteId: string, 
    status: string
  ): Promise<ArtifactMetadata[]> {
    logger.debug('Getting artifacts by conservation status', { siteId, status });
    
    return await this.query({
      KeyConditionExpression: 'siteId = :siteId',
      FilterExpression: 'conservationStatus = :status',
      ExpressionAttributeValues: {
        ':siteId': siteId,
        ':status': status,
      },
    });
  }

  /**
   * Get artifacts by materials used
   */
  public async getArtifactsByMaterial(siteId: string, material: string): Promise<ArtifactMetadata[]> {
    logger.debug('Getting artifacts by material', { siteId, material });
    
    return await this.query({
      KeyConditionExpression: 'siteId = :siteId',
      FilterExpression: 'contains(materials, :material)',
      ExpressionAttributeValues: {
        ':siteId': siteId,
        ':material': material,
      },
    });
  }

  /**
   * Get artifacts with dimensions within a range
   */
  public async getArtifactsByDimensions(
    siteId: string,
    minHeight?: number,
    maxHeight?: number,
    minWidth?: number,
    maxWidth?: number
  ): Promise<ArtifactMetadata[]> {
    logger.debug('Getting artifacts by dimensions', { 
      siteId, 
      minHeight, 
      maxHeight, 
      minWidth, 
      maxWidth 
    });
    
    const filterExpressions: string[] = [];
    const expressionValues: Record<string, any> = { ':siteId': siteId };
    
    if (minHeight !== undefined) {
      filterExpressions.push('dimensions.height >= :minHeight');
      expressionValues[':minHeight'] = minHeight;
    }
    
    if (maxHeight !== undefined) {
      filterExpressions.push('dimensions.height <= :maxHeight');
      expressionValues[':maxHeight'] = maxHeight;
    }
    
    if (minWidth !== undefined) {
      filterExpressions.push('dimensions.width >= :minWidth');
      expressionValues[':minWidth'] = minWidth;
    }
    
    if (maxWidth !== undefined) {
      filterExpressions.push('dimensions.width <= :maxWidth');
      expressionValues[':maxWidth'] = maxWidth;
    }
    
    if (filterExpressions.length === 0) {
      return await this.getArtifactsBySite(siteId);
    }
    
    return await this.query({
      KeyConditionExpression: 'siteId = :siteId',
      FilterExpression: filterExpressions.join(' AND '),
      ExpressionAttributeValues: expressionValues,
    });
  }

  /**
   * Get recently updated artifacts
   */
  public async getRecentlyUpdatedArtifacts(
    siteId: string,
    hoursAgo: number = 24
  ): Promise<ArtifactMetadata[]> {
    logger.debug('Getting recently updated artifacts', { siteId, hoursAgo });
    
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    
    return await this.query({
      KeyConditionExpression: 'siteId = :siteId',
      FilterExpression: 'lastUpdated >= :cutoffTime',
      ExpressionAttributeValues: {
        ':siteId': siteId,
        ':cutoffTime': cutoffTime,
      },
    });
  }

  /**
   * Batch get artifacts by their IDs
   */
  public async batchGetArtifacts(
    artifactKeys: Array<{ artifactId: string; siteId: string }>
  ): Promise<ArtifactMetadata[]> {
    logger.debug('Batch getting artifacts', { count: artifactKeys.length });
    
    if (artifactKeys.length === 0) {
      return [];
    }
    
    const keys = artifactKeys.map(({ artifactId, siteId }) => ({ artifactId, siteId }));
    return await this.batchGet(keys);
  }

  /**
   * Batch create artifacts
   */
  public async batchCreateArtifacts(artifacts: ArtifactMetadata[]): Promise<void> {
    logger.info('Batch creating artifacts', { count: artifacts.length });
    
    if (artifacts.length === 0) {
      return;
    }
    
    // Set timestamps for all artifacts
    const now = new Date().toISOString();
    const artifactsWithTimestamps = artifacts.map(artifact => ({
      ...artifact,
      lastUpdated: now,
    }));
    
    await this.batchWrite(artifactsWithTimestamps);
  }

  /**
   * Batch delete artifacts
   */
  public async batchDeleteArtifacts(
    artifactKeys: Array<{ artifactId: string; siteId: string }>
  ): Promise<void> {
    logger.info('Batch deleting artifacts', { count: artifactKeys.length });
    
    if (artifactKeys.length === 0) {
      return;
    }
    
    const keys = artifactKeys.map(({ artifactId, siteId }) => ({ artifactId, siteId }));
    await this.batchWrite([], keys);
  }

  /**
   * Get artifacts with pagination
   */
  public async getArtifactsWithPagination(
    siteId: string,
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    artifacts: ArtifactMetadata[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    logger.debug('Getting artifacts with pagination', { siteId, limit, hasLastKey: !!lastEvaluatedKey });
    
    const result = await this.executeWithRetry(
      async () => {
        const command = new (await import('@aws-sdk/lib-dynamodb')).QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'siteId = :siteId',
          ExpressionAttributeValues: {
            ':siteId': siteId,
          },
          Limit: limit,
          ExclusiveStartKey: lastEvaluatedKey,
        });
        return await (await import('../utils/aws-clients')).docClient.send(command);
      },
      'getArtifactsWithPagination',
      { siteId, limit }
    );

    return {
      artifacts: (result.Items as ArtifactMetadata[]) || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Update artifact conservation status
   */
  public async updateConservationStatus(
    artifactId: string,
    siteId: string,
    status: string,
    notes?: string
  ): Promise<ArtifactMetadata | null> {
    logger.info('Updating artifact conservation status', { artifactId, siteId, status });
    
    const updates: Record<string, any> = {
      conservationStatus: status,
      lastUpdated: new Date().toISOString(),
    };
    
    if (notes) {
      // Add notes to historical context or create a separate notes field
      const currentArtifact = await this.getByArtifactId(artifactId, siteId);
      if (currentArtifact) {
        updates.historicalContext = `${currentArtifact.historicalContext}\n\nConservation Update (${new Date().toLocaleDateString()}): ${notes}`;
      }
    }
    
    return await this.update({ artifactId, siteId }, updates);
  }

  /**
   * Get artifact statistics for a site
   */
  public async getArtifactStatistics(siteId: string): Promise<{
    totalCount: number;
    typeDistribution: Record<ArtifactType, number>;
    conservationStatusDistribution: Record<string, number>;
    averageDimensions?: {
      height?: number;
      width?: number;
      depth?: number;
    };
  }> {
    logger.debug('Getting artifact statistics', { siteId });
    
    const artifacts = await this.getArtifactsBySite(siteId);
    
    const typeDistribution: Record<ArtifactType, number> = {} as Record<ArtifactType, number>;
    const conservationStatusDistribution: Record<string, number> = {};
    const dimensions: { height: number[]; width: number[]; depth: number[] } = {
      height: [],
      width: [],
      depth: [],
    };
    
    for (const artifact of artifacts) {
      // Type distribution
      typeDistribution[artifact.type] = (typeDistribution[artifact.type] || 0) + 1;
      
      // Conservation status distribution
      if (artifact.conservationStatus) {
        conservationStatusDistribution[artifact.conservationStatus] = 
          (conservationStatusDistribution[artifact.conservationStatus] || 0) + 1;
      }
      
      // Collect dimensions for averaging
      if (artifact.dimensions) {
        if (artifact.dimensions.height) dimensions.height.push(artifact.dimensions.height);
        if (artifact.dimensions.width) dimensions.width.push(artifact.dimensions.width);
        if (artifact.dimensions.depth) dimensions.depth.push(artifact.dimensions.depth);
      }
    }
    
    const averageDimensions: { height?: number; width?: number; depth?: number } = {};
    if (dimensions.height.length > 0) {
      averageDimensions.height = dimensions.height.reduce((a, b) => a + b, 0) / dimensions.height.length;
    }
    if (dimensions.width.length > 0) {
      averageDimensions.width = dimensions.width.reduce((a, b) => a + b, 0) / dimensions.width.length;
    }
    if (dimensions.depth.length > 0) {
      averageDimensions.depth = dimensions.depth.reduce((a, b) => a + b, 0) / dimensions.depth.length;
    }
    
    return {
      totalCount: artifacts.length,
      typeDistribution,
      conservationStatusDistribution,
      averageDimensions: Object.keys(averageDimensions).length > 0 ? averageDimensions : undefined,
    };
  }

  /**
   * Get cache statistics specific to artifacts
   */
  public getArtifactCacheStats(): { size: number; hitRate?: number } {
    return this.getCacheStats();
  }
}