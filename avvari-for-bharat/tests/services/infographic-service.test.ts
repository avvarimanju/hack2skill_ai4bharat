// Unit tests for InfographicService
import { InfographicService } from '../../src/services/infographic-service';
import { Language } from '../../src/models/common';

// Mock dependencies
jest.mock('../../src/utils/logger');

describe('InfographicService', () => {
  let service: InfographicService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InfographicService();
  });

  describe('generateInfographic', () => {
    it('should generate timeline infographic successfully', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'timeline',
        language: Language.ENGLISH,
        data: {
          title: 'Historical Timeline',
          timelineData: [
            {
              id: '1',
              date: '1500',
              title: 'Event 1',
              description: 'First event',
            },
            {
              id: '2',
              date: '1600',
              title: 'Event 2',
              description: 'Second event',
            },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.infographicUrl).toBeDefined();
      expect(result.thumbnailUrl).toBeDefined();
      expect(result.format).toBe('svg');
      expect(result.metadata?.type).toBe('timeline');
    });

    it('should generate map infographic successfully', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'map',
        language: Language.HINDI,
        data: {
          title: 'Heritage Sites Map',
          mapData: [
            {
              id: '1',
              name: 'Site 1',
              latitude: 28.6139,
              longitude: 77.209,
              type: 'site',
            },
            {
              id: '2',
              name: 'Site 2',
              latitude: 28.7041,
              longitude: 77.1025,
              type: 'artifact',
            },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('map');
    });

    it('should generate diagram infographic successfully', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'diagram',
        language: Language.TAMIL,
        data: {
          title: 'Relationship Diagram',
          diagramData: [
            {
              id: '1',
              label: 'Node 1',
              description: 'First node',
              connections: ['2'],
            },
            {
              id: '2',
              label: 'Node 2',
              description: 'Second node',
            },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('diagram');
    });

    it('should generate architectural infographic successfully', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'architectural',
        language: Language.ENGLISH,
        data: {
          title: 'Architectural Elements',
          architecturalData: [
            {
              id: '1',
              name: 'Dome',
              type: 'structure',
              description: 'Main dome structure',
              period: '16th century',
            },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('architectural');
    });

    it('should generate cultural context infographic successfully', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'cultural-context',
        language: Language.BENGALI,
        data: {
          title: 'Cultural Context',
          description: 'Cultural significance',
        },
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('cultural-context');
    });

    it('should handle missing artifact ID', async () => {
      const result = await service.generateInfographic({
        artifactId: '',
        siteId: 'site-456',
        infographicType: 'timeline',
        language: Language.ENGLISH,
        data: {
          title: 'Test',
          timelineData: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Artifact ID and Site ID are required');
    });

    it('should handle missing site ID', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: '',
        infographicType: 'map',
        language: Language.HINDI,
        data: {
          title: 'Test',
          mapData: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Artifact ID and Site ID are required');
    });

    it('should handle missing title', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'timeline',
        language: Language.ENGLISH,
        data: {
          title: '',
          timelineData: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Infographic data with title is required');
    });

    it('should generate interactive infographic', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'timeline',
        language: Language.ENGLISH,
        interactive: true,
        data: {
          title: 'Interactive Timeline',
          timelineData: [
            {
              id: '1',
              date: '1500',
              title: 'Event',
              description: 'Description',
            },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('interactive-html');
      expect(result.interactive).toBe(true);
    });
  });

  describe('Data Validation', () => {
    it('should validate timeline data', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'timeline',
        language: Language.ENGLISH,
        data: {
          title: 'Timeline',
          timelineData: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeline data is required for timeline infographics');
    });

    it('should validate map data', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'map',
        language: Language.ENGLISH,
        data: {
          title: 'Map',
          mapData: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Map data is required for map infographics');
    });

    it('should validate diagram data', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'diagram',
        language: Language.ENGLISH,
        data: {
          title: 'Diagram',
          diagramData: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Diagram data is required for diagram infographics');
    });

    it('should validate architectural data', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'architectural',
        language: Language.ENGLISH,
        data: {
          title: 'Architecture',
          architecturalData: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Architectural data is required for architectural infographics');
    });

    it('should validate latitude range', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'map',
        language: Language.ENGLISH,
        data: {
          title: 'Map',
          mapData: [
            {
              id: '1',
              name: 'Invalid Location',
              latitude: 100, // Invalid
              longitude: 77,
            },
          ],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid latitude');
    });

    it('should validate longitude range', async () => {
      const result = await service.generateInfographic({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        infographicType: 'map',
        language: Language.ENGLISH,
        data: {
          title: 'Map',
          mapData: [
            {
              id: '1',
              name: 'Invalid Location',
              latitude: 28,
              longitude: 200, // Invalid
            },
          ],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid longitude');
    });
  });

  describe('addInteractiveElements', () => {
    it('should add interactive elements successfully', () => {
      const result = service.addInteractiveElements('infographic-123', [
        {
          id: '1',
          type: 'hotspot',
          targetId: 'element-1',
          action: 'show-details',
        },
        {
          id: '2',
          type: 'tooltip',
          targetId: 'element-2',
          action: 'display-info',
        },
      ]);

      expect(result.success).toBe(true);
    });

    it('should handle empty elements array', () => {
      const result = service.addInteractiveElements('infographic-123', []);

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least one interactive element is required');
    });
  });

  describe('optimizeForMobile', () => {
    it('should optimize infographic for mobile', () => {
      const result = service.optimizeForMobile(
        'https://cdn.avvari.com/infographics/test.svg',
        'timeline'
      );

      expect(result.success).toBe(true);
      expect(result.mobileUrl).toBeDefined();
      expect(result.mobileUrl).toContain('-mobile');
    });

    it('should handle HTML format', () => {
      const result = service.optimizeForMobile(
        'https://cdn.avvari.com/infographics/test.html',
        'map'
      );

      expect(result.success).toBe(true);
      expect(result.mobileUrl).toContain('-mobile.html');
    });
  });

  describe('getDimensions', () => {
    it('should get dimensions for timeline', () => {
      const dimensions = service.getDimensions('timeline');

      expect(dimensions.width).toBe(1200);
      expect(dimensions.height).toBe(600);
    });

    it('should get dimensions for map', () => {
      const dimensions = service.getDimensions('map');

      expect(dimensions.width).toBe(1000);
      expect(dimensions.height).toBe(800);
    });

    it('should get dimensions for diagram', () => {
      const dimensions = service.getDimensions('diagram');

      expect(dimensions.width).toBe(1000);
      expect(dimensions.height).toBe(1000);
    });

    it('should get dimensions for architectural', () => {
      const dimensions = service.getDimensions('architectural');

      expect(dimensions.width).toBe(1200);
      expect(dimensions.height).toBe(900);
    });

    it('should get dimensions for cultural-context', () => {
      const dimensions = service.getDimensions('cultural-context');

      expect(dimensions.width).toBe(1000);
      expect(dimensions.height).toBe(700);
    });
  });

  describe('Validation Methods', () => {
    it('should validate supported types', () => {
      expect(service.isTypeSupported('timeline')).toBe(true);
      expect(service.isTypeSupported('map')).toBe(true);
      expect(service.isTypeSupported('diagram')).toBe(true);
      expect(service.isTypeSupported('architectural')).toBe(true);
      expect(service.isTypeSupported('cultural-context')).toBe(true);
      expect(service.isTypeSupported('invalid')).toBe(false);
    });

    it('should validate supported formats', () => {
      expect(service.isFormatSupported('svg')).toBe(true);
      expect(service.isFormatSupported('png')).toBe(true);
      expect(service.isFormatSupported('interactive-html')).toBe(true);
      expect(service.isFormatSupported('pdf')).toBe(false);
    });

    it('should get list of supported types', () => {
      const types = service.getSupportedTypes();

      expect(types).toContain('timeline');
      expect(types).toContain('map');
      expect(types).toContain('diagram');
      expect(types).toContain('architectural');
      expect(types).toContain('cultural-context');
      expect(types.length).toBe(5);
    });

    it('should get list of supported formats', () => {
      const formats = service.getSupportedFormats();

      expect(formats).toContain('svg');
      expect(formats).toContain('png');
      expect(formats).toContain('interactive-html');
      expect(formats.length).toBe(3);
    });
  });

  describe('extractArchitecturalInfo', () => {
    it('should extract architectural elements from data', () => {
      const artifactData = {
        architecture: [
          {
            id: '1',
            name: 'Dome',
            type: 'structure',
            description: 'Main dome',
          },
          {
            id: '2',
            name: 'Pillar',
            type: 'structure',
            description: 'Support pillar',
          },
        ],
      };

      const elements = service.extractArchitecturalInfo(artifactData);

      expect(elements.length).toBe(2);
      expect(elements[0].name).toBe('Dome');
      expect(elements[1].name).toBe('Pillar');
    });

    it('should handle missing architecture data', () => {
      const elements = service.extractArchitecturalInfo({});

      expect(elements.length).toBe(0);
    });
  });

  describe('generateTimelineFromEvents', () => {
    it('should generate timeline events', () => {
      const events = [
        {
          date: '1500',
          title: 'Event 1',
          description: 'First event',
          category: 'historical',
        },
        {
          year: '1600',
          name: 'Event 2',
          description: 'Second event',
        },
      ];

      const timeline = service.generateTimelineFromEvents(events);

      expect(timeline.length).toBe(2);
      expect(timeline[0].date).toBe('1500');
      expect(timeline[0].title).toBe('Event 1');
      expect(timeline[1].date).toBe('1600');
      expect(timeline[1].title).toBe('Event 2');
    });

    it('should handle events with missing data', () => {
      const events = [
        {},
        { title: 'Event' },
      ];

      const timeline = service.generateTimelineFromEvents(events);

      expect(timeline.length).toBe(2);
      expect(timeline[0].date).toBe('Unknown');
      expect(timeline[0].title).toBe('Untitled Event');
      expect(timeline[1].title).toBe('Event');
    });
  });

  describe('calculateMapBounds', () => {
    it('should calculate bounds from locations', () => {
      const locations = [
        { id: '1', name: 'Loc 1', latitude: 28.6, longitude: 77.2 },
        { id: '2', name: 'Loc 2', latitude: 28.7, longitude: 77.1 },
        { id: '3', name: 'Loc 3', latitude: 28.5, longitude: 77.3 },
      ];

      const bounds = service.calculateMapBounds(locations);

      expect(bounds.minLat).toBe(28.5);
      expect(bounds.maxLat).toBe(28.7);
      expect(bounds.minLng).toBe(77.1);
      expect(bounds.maxLng).toBe(77.3);
    });

    it('should handle empty locations', () => {
      const bounds = service.calculateMapBounds([]);

      expect(bounds.minLat).toBe(0);
      expect(bounds.maxLat).toBe(0);
      expect(bounds.minLng).toBe(0);
      expect(bounds.maxLng).toBe(0);
    });

    it('should handle single location', () => {
      const locations = [
        { id: '1', name: 'Loc 1', latitude: 28.6, longitude: 77.2 },
      ];

      const bounds = service.calculateMapBounds(locations);

      expect(bounds.minLat).toBe(28.6);
      expect(bounds.maxLat).toBe(28.6);
      expect(bounds.minLng).toBe(77.2);
      expect(bounds.maxLng).toBe(77.2);
    });
  });
});
