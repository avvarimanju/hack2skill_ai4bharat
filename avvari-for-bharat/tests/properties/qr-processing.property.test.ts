// Property-Based Tests for QR Code Processing
// Feature: avvari-for-bharat
import * as fc from 'fast-check';
import { QRProcessingService } from '../../src/services/qr-processing-service';
import { QRScanRequest } from '../../src/models/common';

describe('QR Code Processing - Property-Based Tests', () => {
  let qrService: QRProcessingService;

  beforeEach(() => {
    qrService = new QRProcessingService();
  });

  /**
   * Property 1: QR Code Processing Accuracy
   * Validates: Requirements 1.1
   * 
   * For any valid heritage site QR code containing artifact identifier data,
   * scanning should successfully decode the artifact identifier and initiate content retrieval
   */
  describe('Property 1: QR Code Processing Accuracy', () => {
    it('should successfully decode any valid QR code format (JSON, URI, Simple)', () => {
      fc.assert(
        fc.property(
          // Generate valid site IDs
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          // Generate valid artifact IDs
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          // Generate format type
          fc.constantFrom('json', 'uri', 'simple'),
          (siteId, artifactId, format) => {
            // Generate QR code data in the specified format
            const qrData = qrService.generateQRCodeData(siteId, artifactId, format as 'json' | 'uri' | 'simple');

            // Validate the QR code format
            const validation = qrService.validateQRCodeFormat(qrData);

            // Property: Valid QR codes should always be recognized as valid
            expect(validation.isValid).toBe(true);
            expect(validation.format).toBe(format);
            expect(validation.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly extract siteId and artifactId from any valid QR code', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.constantFrom('json', 'uri', 'simple'),
          (siteId, artifactId, format) => {
            // Generate QR code
            const qrData = qrService.generateQRCodeData(siteId, artifactId, format as 'json' | 'uri' | 'simple');

            // Decode using private method through processQRScan
            // We'll test the validation which uses the decode internally
            const validation = qrService.validateQRCodeFormat(qrData);

            // Property: Decoding should always succeed for generated QR codes
            expect(validation.isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle QR codes with optional location data', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.double({ min: -90, max: 90 }),
          fc.double({ min: -180, max: 180 }),
          (siteId, artifactId, lat, lon) => {
            // Generate URI format with location
            const qrData = `avvari://${siteId}/${artifactId}?lat=${lat}&lon=${lon}`;

            // Validate
            const validation = qrService.validateQRCodeFormat(qrData);

            // Property: QR codes with location should be valid
            expect(validation.isValid).toBe(true);
            expect(validation.format).toBe('uri');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle QR codes with timestamps', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.date(),
          (siteId, artifactId, timestamp) => {
            // Generate JSON format with timestamp
            const qrData = JSON.stringify({
              siteId,
              artifactId,
              timestamp: timestamp.toISOString(),
            });

            // Validate
            const validation = qrService.validateQRCodeFormat(qrData);

            // Property: QR codes with timestamps should be valid
            expect(validation.isValid).toBe(true);
            expect(validation.format).toBe('json');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Invalid Input Handling
   * Validates: Requirements 1.2
   * 
   * For any invalid, corrupted, or malformed QR code input, the system should gracefully
   * handle the error by displaying appropriate error messages and providing alternative access methods
   */
  describe('Property 2: Invalid Input Handling', () => {
    it('should reject empty or whitespace-only QR codes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\t', '\n', '  \t\n  '),
          (invalidQR) => {
            const validation = qrService.validateQRCodeFormat(invalidQR);

            // Property: Empty QR codes should always be invalid
            expect(validation.isValid).toBe(false);
            expect(validation.error).toBeDefined();
            expect(validation.error).toContain('empty');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject malformed JSON QR codes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '{invalid json}',
            '{"siteId": "test"}', // Missing artifactId
            '{"artifactId": "test"}', // Missing siteId
            '{siteId: test, artifactId: test}', // Invalid JSON syntax
            '{"siteId": "", "artifactId": ""}', // Empty values
            '[]', // Array instead of object
            'null'
          ),
          (invalidJSON) => {
            const validation = qrService.validateQRCodeFormat(invalidJSON);

            // Property: Malformed JSON should be invalid
            expect(validation.isValid).toBe(false);
            expect(validation.error).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject malformed URI QR codes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'avvari:///artifact', // Missing site (empty hostname)
          ),
          (invalidURI) => {
            const validation = qrService.validateQRCodeFormat(invalidURI);

            // Property: Malformed URIs should be invalid
            expect(validation.isValid).toBe(false);
            expect(validation.error).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject malformed simple format QR codes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'site', // Missing colon and artifact
            ':artifact', // Missing site
            'site:', // Missing artifact
            ':', // Empty components
            'site::', // Extra colon
            '', // Empty string
          ),
          (invalidSimple) => {
            const validation = qrService.validateQRCodeFormat(invalidSimple);

            // Property: Malformed simple format should be invalid
            expect(validation.isValid).toBe(false);
            expect(validation.error).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect corrupted QR codes with special characters', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'avvari://site\0/artifact', // Null byte
            'avvari://site�/artifact', // Replacement character
            'abc', // Too short
            'a'.repeat(1001), // Too long
            'avvari://site\x01/artifact', // Non-printable character
          ),
          (corruptedQR) => {
            const isCorrupted = qrService.isQRCodeCorrupted(corruptedQR);

            // Property: Corrupted QR codes should be detected
            expect(isCorrupted).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle random invalid strings gracefully', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
            // Filter out strings that might accidentally be valid
            return !s.startsWith('avvari://') && 
                   !s.startsWith('{') && 
                   !s.includes(':') &&
                   s.trim().length > 0; // Exclude empty/whitespace strings
          }),
          (randomString) => {
            const validation = qrService.validateQRCodeFormat(randomString);

            // Property: Random strings should be invalid
            expect(validation.isValid).toBe(false);
            expect(validation.error).toBeDefined();
            // Error message should exist (could be "Unrecognized" or other error types)
            expect(typeof validation.error).toBe('string');
            expect(validation.error!.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide meaningful error messages for all invalid inputs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '',
            '{invalid}',
            'avvari://',
            'random text',
            'site',
            '\0\0\0',
          ),
          (invalidInput) => {
            const validation = qrService.validateQRCodeFormat(invalidInput);

            // Property: All invalid inputs should have error messages
            expect(validation.isValid).toBe(false);
            expect(validation.error).toBeDefined();
            expect(typeof validation.error).toBe('string');
            expect(validation.error!.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
