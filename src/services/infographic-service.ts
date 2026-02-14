// Infographic Service for interactive content generation
import { Language } from '../models/common';
import { logger } from '../utils/logger';

export interface InfographicGenerationRequest {
  artifactId: string;
  siteId: string;
  infographicType: InfographicType;
  language: Language;
  data: InfographicData;
  interactive?: boolean;
  mobileOptimized?: boolean;
}

export interface InfographicGenerationResult {
  success: boolean;
  infographicUrl?: string;
  thumbnailUrl?: string;
  format?: InfographicFormat;
  interactive?: boolean;
  metadata?: InfographicMetadata;
  error?: string;
}

export type InfographicType = 'timeline' | 'map' | 'diagram' | 'architectural' | 'cultural-context';
export type InfographicFormat = 'svg' | 'png' | 'interactive-html';

export interface InfographicData {
  title: string;
  description?: string;
  timelineData?: TimelineEvent[];
  mapData?: MapLocation[];
  diagramData?: DiagramNode[];
  architecturalData?: ArchitecturalElement[];
}

export interface TimelineEvent {
  id: string;
  date: string | Date;
  title: string;
  description: string;
  imageUrl?: string;
  category?: string;
}

export interface MapLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  type?: 'site' | 'artifact' | 'poi';
  imageUrl?: string;
}

export interface DiagramNode {
  id: string;
  label: string;
  description?: string;
  connections?: string[]; // IDs of connected nodes
  position?: { x: number; y: number };
  type?: 'primary' | 'secondary' | 'tertiary';
}

export interface ArchitecturalElement {
  id: string;
  name: string;
  type: 'structure' | 'decoration' | 'material' | 'style';
  description: string;
  period?: string;
  imageUrl?: string;
  dimensions?: {
    height?: number;
    width?: number;
    depth?: number;
    unit: 'meters' | 'feet';
  };
}

export interface InfographicMetadata {
  infographicId: string;
  type: InfographicType;
  format: InfographicFormat;
  width: number;
  height: number;
  interactive: boolean;
  createdAt: Date;
  language: Language;
}

export interface InteractiveElement {
  id: string;
  type: 'hotspot' | 'tooltip' | 'zoom' | 'pan' | 'click';
  targetId: string;
  action: string;
  data?: any;
}

export class InfographicService {
  private readonly defaultDimensions: Record<InfographicType, { width: number; height: number }>;

  constructor() {
    // Default dimensions for different infographic types
    this.defaultDimensions = {
      timeline: { width: 1200, height: 600 },
      map: { width: 1000, height: 800 },
      diagram: { width: 1000, height: 1000 },
      architectural: { width: 1200, height: 900 },
      'cultural-context': { width: 1000, height: 700 },
    };

    logger.info('Infographic service initialized');
  }

  /**
   * Generate infographic content
   */
  public async generateInfographic(
    request: InfographicGenerationRequest
  ): Promise<InfographicGenerationResult> {
    logger.info('Generating infographic', {
      artifactId: request.artifactId,
      type: request.infographicType,
      language: request.language,
    });

    try {
      // Validate request
      if (!request.artifactId || !request.siteId) {
        return {
          success: false,
          error: 'Artifact ID and Site ID are required',
        };
      }

      if (!request.data || !request.data.title) {
        return {
          success: false,
          error: 'Infographic data with title is required',
        };
      }

      // Validate data based on type
      const validationError = this.validateInfographicData(request.infographicType, request.data);
      if (validationError) {
        return {
          success: false,
          error: validationError,
        };
      }

      // Generate infographic based on type
      let result: InfographicGenerationResult;

      switch (request.infographicType) {
        case 'timeline':
          result = await this.generateTimeline(request);
          break;
        case 'map':
          result = await this.generateMap(request);
          break;
        case 'diagram':
          result = await this.generateDiagram(request);
          break;
        case 'architectural':
          result = await this.generateArchitecturalInfo(request);
          break;
        case 'cultural-context':
          result = await this.generateCulturalContext(request);
          break;
        default:
          return {
            success: false,
            error: `Unsupported infographic type: ${request.infographicType}`,
          };
      }

      logger.info('Infographic generation completed', {
        type: request.infographicType,
        format: result.format,
      });

      return result;
    } catch (error) {
      logger.error('Infographic generation failed', {
        error: error instanceof Error ? error.message : String(error),
        artifactId: request.artifactId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Infographic generation failed',
      };
    }
  }

  /**
   * Generate timeline infographic
   */
  private async generateTimeline(
    request: InfographicGenerationRequest
  ): Promise<InfographicGenerationResult> {
    const events = request.data.timelineData || [];
    const dimensions = this.defaultDimensions.timeline;
    const format: InfographicFormat = request.interactive ? 'interactive-html' : 'svg';

    const infographicId = `timeline-${request.artifactId}-${Date.now()}`;
    const infographicUrl = `https://cdn.avvari.com/infographics/${infographicId}.${format === 'interactive-html' ? 'html' : 'svg'}`;
    const thumbnailUrl = `https://cdn.avvari.com/thumbnails/${infographicId}.jpg`;

    // In production, this would generate actual SVG/HTML content
    // For now, return metadata

    return {
      success: true,
      infographicUrl,
      thumbnailUrl,
      format,
      interactive: request.interactive || false,
      metadata: {
        infographicId,
        type: 'timeline',
        format,
        width: dimensions.width,
        height: dimensions.height,
        interactive: request.interactive || false,
        createdAt: new Date(),
        language: request.language,
      },
    };
  }

  /**
   * Generate map infographic
   */
  private async generateMap(
    request: InfographicGenerationRequest
  ): Promise<InfographicGenerationResult> {
    const locations = request.data.mapData || [];
    const dimensions = this.defaultDimensions.map;
    const format: InfographicFormat = request.interactive ? 'interactive-html' : 'svg';

    const infographicId = `map-${request.artifactId}-${Date.now()}`;
    const infographicUrl = `https://cdn.avvari.com/infographics/${infographicId}.${format === 'interactive-html' ? 'html' : 'svg'}`;
    const thumbnailUrl = `https://cdn.avvari.com/thumbnails/${infographicId}.jpg`;

    return {
      success: true,
      infographicUrl,
      thumbnailUrl,
      format,
      interactive: request.interactive || false,
      metadata: {
        infographicId,
        type: 'map',
        format,
        width: dimensions.width,
        height: dimensions.height,
        interactive: request.interactive || false,
        createdAt: new Date(),
        language: request.language,
      },
    };
  }

  /**
   * Generate diagram infographic
   */
  private async generateDiagram(
    request: InfographicGenerationRequest
  ): Promise<InfographicGenerationResult> {
    const nodes = request.data.diagramData || [];
    const dimensions = this.defaultDimensions.diagram;
    const format: InfographicFormat = request.interactive ? 'interactive-html' : 'svg';

    const infographicId = `diagram-${request.artifactId}-${Date.now()}`;
    const infographicUrl = `https://cdn.avvari.com/infographics/${infographicId}.${format === 'interactive-html' ? 'html' : 'svg'}`;
    const thumbnailUrl = `https://cdn.avvari.com/thumbnails/${infographicId}.jpg`;

    return {
      success: true,
      infographicUrl,
      thumbnailUrl,
      format,
      interactive: request.interactive || false,
      metadata: {
        infographicId,
        type: 'diagram',
        format,
        width: dimensions.width,
        height: dimensions.height,
        interactive: request.interactive || false,
        createdAt: new Date(),
        language: request.language,
      },
    };
  }

  /**
   * Generate architectural information infographic
   */
  private async generateArchitecturalInfo(
    request: InfographicGenerationRequest
  ): Promise<InfographicGenerationResult> {
    const elements = request.data.architecturalData || [];
    const dimensions = this.defaultDimensions.architectural;
    const format: InfographicFormat = request.interactive ? 'interactive-html' : 'svg';

    const infographicId = `arch-${request.artifactId}-${Date.now()}`;
    const infographicUrl = `https://cdn.avvari.com/infographics/${infographicId}.${format === 'interactive-html' ? 'html' : 'svg'}`;
    const thumbnailUrl = `https://cdn.avvari.com/thumbnails/${infographicId}.jpg`;

    return {
      success: true,
      infographicUrl,
      thumbnailUrl,
      format,
      interactive: request.interactive || false,
      metadata: {
        infographicId,
        type: 'architectural',
        format,
        width: dimensions.width,
        height: dimensions.height,
        interactive: request.interactive || false,
        createdAt: new Date(),
        language: request.language,
      },
    };
  }

  /**
   * Generate cultural context infographic
   */
  private async generateCulturalContext(
    request: InfographicGenerationRequest
  ): Promise<InfographicGenerationResult> {
    const dimensions = this.defaultDimensions['cultural-context'];
    const format: InfographicFormat = request.interactive ? 'interactive-html' : 'svg';

    const infographicId = `cultural-${request.artifactId}-${Date.now()}`;
    const infographicUrl = `https://cdn.avvari.com/infographics/${infographicId}.${format === 'interactive-html' ? 'html' : 'svg'}`;
    const thumbnailUrl = `https://cdn.avvari.com/thumbnails/${infographicId}.jpg`;

    return {
      success: true,
      infographicUrl,
      thumbnailUrl,
      format,
      interactive: request.interactive || false,
      metadata: {
        infographicId,
        type: 'cultural-context',
        format,
        width: dimensions.width,
        height: dimensions.height,
        interactive: request.interactive || false,
        createdAt: new Date(),
        language: request.language,
      },
    };
  }

  /**
   * Validate infographic data based on type
   */
  private validateInfographicData(type: InfographicType, data: InfographicData): string | null {
    switch (type) {
      case 'timeline':
        if (!data.timelineData || data.timelineData.length === 0) {
          return 'Timeline data is required for timeline infographics';
        }
        break;
      case 'map':
        if (!data.mapData || data.mapData.length === 0) {
          return 'Map data is required for map infographics';
        }
        // Validate coordinates
        for (const location of data.mapData) {
          if (location.latitude < -90 || location.latitude > 90) {
            return `Invalid latitude for location ${location.name}: ${location.latitude}`;
          }
          if (location.longitude < -180 || location.longitude > 180) {
            return `Invalid longitude for location ${location.name}: ${location.longitude}`;
          }
        }
        break;
      case 'diagram':
        if (!data.diagramData || data.diagramData.length === 0) {
          return 'Diagram data is required for diagram infographics';
        }
        break;
      case 'architectural':
        if (!data.architecturalData || data.architecturalData.length === 0) {
          return 'Architectural data is required for architectural infographics';
        }
        break;
    }

    return null;
  }

  /**
   * Add interactive elements to infographic
   */
  public addInteractiveElements(
    infographicId: string,
    elements: InteractiveElement[]
  ): { success: boolean; error?: string } {
    logger.info('Adding interactive elements', {
      infographicId,
      elementCount: elements.length,
    });

    try {
      // In production, this would update the infographic with interactive elements
      // For now, just validate and return success

      if (elements.length === 0) {
        return {
          success: false,
          error: 'At least one interactive element is required',
        };
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to add interactive elements', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add interactive elements',
      };
    }
  }

  /**
   * Optimize infographic for mobile
   */
  public optimizeForMobile(
    infographicUrl: string,
    type: InfographicType
  ): { success: boolean; mobileUrl?: string; error?: string } {
    logger.info('Optimizing infographic for mobile', { infographicUrl, type });

    try {
      // In production, this would create a mobile-optimized version
      const mobileUrl = infographicUrl.replace(/\.(svg|html)$/, '-mobile.$1');

      return {
        success: true,
        mobileUrl,
      };
    } catch (error) {
      logger.error('Mobile optimization failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Mobile optimization failed',
      };
    }
  }

  /**
   * Get dimensions for infographic type
   */
  public getDimensions(type: InfographicType): { width: number; height: number } {
    return this.defaultDimensions[type];
  }

  /**
   * Get supported infographic types
   */
  public getSupportedTypes(): InfographicType[] {
    return ['timeline', 'map', 'diagram', 'architectural', 'cultural-context'];
  }

  /**
   * Get supported formats
   */
  public getSupportedFormats(): InfographicFormat[] {
    return ['svg', 'png', 'interactive-html'];
  }

  /**
   * Validate infographic type
   */
  public isTypeSupported(type: string): type is InfographicType {
    return this.getSupportedTypes().includes(type as InfographicType);
  }

  /**
   * Validate format
   */
  public isFormatSupported(format: string): format is InfographicFormat {
    return this.getSupportedFormats().includes(format as InfographicFormat);
  }

  /**
   * Extract architectural information from artifact data
   */
  public extractArchitecturalInfo(artifactData: any): ArchitecturalElement[] {
    // In production, this would use AI/ML to extract architectural information
    // For now, return a placeholder structure

    const elements: ArchitecturalElement[] = [];

    if (artifactData.architecture) {
      // Extract from structured data
      if (Array.isArray(artifactData.architecture)) {
        elements.push(...artifactData.architecture);
      }
    }

    return elements;
  }

  /**
   * Generate timeline from historical events
   */
  public generateTimelineFromEvents(events: any[]): TimelineEvent[] {
    return events.map((event, index) => ({
      id: `event-${index}`,
      date: event.date || event.year || 'Unknown',
      title: event.title || event.name || 'Untitled Event',
      description: event.description || '',
      imageUrl: event.image || event.imageUrl,
      category: event.category || event.type,
    }));
  }

  /**
   * Calculate map bounds from locations
   */
  public calculateMapBounds(locations: MapLocation[]): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    if (locations.length === 0) {
      return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
    }

    const lats = locations.map(l => l.latitude);
    const lngs = locations.map(l => l.longitude);

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }
}
