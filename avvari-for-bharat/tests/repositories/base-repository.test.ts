// Unit tests for BaseRepository
import { BaseRepository, RetryConfig } from '../../src/repositories/base-repository';
import { ValidationResult } from '../../src/models/common';
import { docClient } from '../../src/utils/aws-clients';
import { logger } from '../../src/utils/logger';

// Mock AWS clients
jest.mock('../../src/utils/aws-clients');
jest.mock('../../src/utils/logger');

// Test entity interface
interface TestEntity {
  id: string;
  name: string;
  value: number;
}

// Concrete implementation for testing
class TestRepository extends BaseRepository<TestEntity> {
  constructor(retryConfig?: RetryConfig, cacheEnabled?: boolean, cacheTtl?: number) {
    super('test-table', retryConfig, cacheEnabled, cacheTtl);
  }

  protected validateEntity(entity: TestEntity): ValidationResult {
    const errors: string[] = [];
    
    if (!entity.id) errors.push('ID is required');
    if (!entity.name) errors.push('Name is required');
    if (typeof entity.value !== 'number') errors.push('Value must be a number');
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  protected getPrimaryKey(entity: TestEntity): Record<string, any> {
    return { id: entity.id };
  }

  protected getCacheKey(key: Record<string, any>): string {
    return `test:${key.id}`;
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository;
  let mockDocClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient = docClient as any;
    mockDocClient.send = jest.fn();
    repository = new TestRepository();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const repo = new TestRepository();
      expect(repo).toBeInstanceOf(BaseRepository);
    });

    it('should initialize with custom configuration', () => {
      const customRetryConfig: RetryConfig = {
        maxRetries: 5,
        baseDelayMs: 200,
        maxDelayMs: 10000,
        backoffMultiplier: 3,
      };
      
      const repo = new TestRepository(customRetryConfig, false, 60000);
      expect(repo).toBeInstanceOf(BaseRepository);
    });
  });

  describe('get', () => {
    it('should retrieve item successfully', async () => {
      const testEntity: TestEntity = { id: '1', name: 'Test', value: 100 };
      
      mockDocClient.send.mockResolvedValueOnce({
        Item: testEntity,
      });

      const result = await repository.get({ id: '1' });
      
      expect(result).toEqual(testEntity);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should return null when item not found', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      const result = await repository.get({ id: 'nonexistent' });
      
      expect(result).toBeNull();
    });

    it('should use cache when available', async () => {
      const testEntity: TestEntity = { id: '1', name: 'Test', value: 100 };
      
      // First call - should hit database and cache
      mockDocClient.send.mockResolvedValueOnce({
        Item: testEntity,
      });

      const result1 = await repository.get({ id: '1' });
      expect(result1).toEqual(testEntity);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);

      // Second call - should hit cache
      const result2 = await repository.get({ id: '1' });
      expect(result2).toEqual(testEntity);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1); // No additional call
    });
  });

  describe('put', () => {
    it('should put item successfully', async () => {
      const testEntity: TestEntity = { id: '1', name: 'Test', value: 100 };
      
      mockDocClient.send.mockResolvedValueOnce({});

      await repository.put(testEntity);
      
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should validate entity before putting', async () => {
      const invalidEntity = { id: '', name: '', value: 'invalid' } as any;
      
      await expect(repository.put(invalidEntity)).rejects.toThrow('Validation failed');
      expect(mockDocClient.send).not.toHaveBeenCalled();
    });

    it('should support overwrite option', async () => {
      const testEntity: TestEntity = { id: '1', name: 'Test', value: 100 };
      
      mockDocClient.send.mockResolvedValueOnce({});

      await repository.put(testEntity, { overwrite: false });
      
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      // Should include condition expression for no overwrite
    });
  });

  describe('update', () => {
    it('should update item successfully', async () => {
      const updatedEntity: TestEntity = { id: '1', name: 'Updated', value: 200 };
      
      mockDocClient.send.mockResolvedValueOnce({
        Attributes: updatedEntity,
      });

      const result = await repository.update({ id: '1' }, { name: 'Updated', value: 200 });
      
      expect(result).toEqual(updatedEntity);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should return null when update fails', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      const result = await repository.update({ id: '1' }, { name: 'Updated' });
      
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete item successfully', async () => {
      const deletedEntity: TestEntity = { id: '1', name: 'Test', value: 100 };
      
      mockDocClient.send.mockResolvedValueOnce({
        Attributes: deletedEntity,
      });

      const result = await repository.delete({ id: '1' });
      
      expect(result).toEqual(deletedEntity);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('query', () => {
    it('should query items successfully', async () => {
      const testEntities: TestEntity[] = [
        { id: '1', name: 'Test1', value: 100 },
        { id: '2', name: 'Test2', value: 200 },
      ];
      
      mockDocClient.send.mockResolvedValueOnce({
        Items: testEntities,
      });

      const result = await repository.query({
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': '1' },
      });
      
      expect(result).toEqual(testEntities);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no items found', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      const result = await repository.query({
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': 'nonexistent' },
      });
      
      expect(result).toEqual([]);
    });
  });

  describe('scan', () => {
    it('should scan items successfully', async () => {
      const testEntities: TestEntity[] = [
        { id: '1', name: 'Test1', value: 100 },
        { id: '2', name: 'Test2', value: 200 },
      ];
      
      mockDocClient.send.mockResolvedValueOnce({
        Items: testEntities,
      });

      const result = await repository.scan();
      
      expect(result).toEqual(testEntities);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('batchGet', () => {
    it('should batch get items successfully', async () => {
      const testEntities: TestEntity[] = [
        { id: '1', name: 'Test1', value: 100 },
        { id: '2', name: 'Test2', value: 200 },
      ];
      
      mockDocClient.send.mockResolvedValueOnce({
        Responses: {
          'test-table': testEntities,
        },
      });

      const result = await repository.batchGet([{ id: '1' }, { id: '2' }]);
      
      expect(result).toEqual(testEntities);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should return empty array for empty keys', async () => {
      const result = await repository.batchGet([]);
      
      expect(result).toEqual([]);
      expect(mockDocClient.send).not.toHaveBeenCalled();
    });
  });

  describe('batchWrite', () => {
    it('should batch write items successfully', async () => {
      const testEntities: TestEntity[] = [
        { id: '1', name: 'Test1', value: 100 },
        { id: '2', name: 'Test2', value: 200 },
      ];
      
      mockDocClient.send.mockResolvedValueOnce({});

      await repository.batchWrite(testEntities);
      
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should validate entities before batch write', async () => {
      const invalidEntities = [
        { id: '', name: '', value: 'invalid' },
      ] as any;
      
      await expect(repository.batchWrite(invalidEntities)).rejects.toThrow('Validation failed');
      expect(mockDocClient.send).not.toHaveBeenCalled();
    });

    it('should handle empty arrays', async () => {
      await repository.batchWrite([], []);
      
      expect(mockDocClient.send).not.toHaveBeenCalled();
    });
  });

  describe('retry logic', () => {
    it('should retry on retryable errors', async () => {
      const retryableError = {
        code: 'ProvisionedThroughputExceededException',
        message: 'Throughput exceeded',
      };
      
      mockDocClient.send
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ Item: { id: '1', name: 'Test', value: 100 } });

      const result = await repository.get({ id: '1' });
      
      expect(result).toEqual({ id: '1', name: 'Test', value: 100 });
      expect(mockDocClient.send).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = {
        code: 'ValidationException',
        message: 'Invalid request',
      };
      
      mockDocClient.send.mockRejectedValueOnce(nonRetryableError);

      await expect(repository.get({ id: '1' })).rejects.toEqual(nonRetryableError);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const retryableError = {
        code: 'ThrottlingException',
        message: 'Request throttled',
      };
      
      mockDocClient.send.mockRejectedValue(retryableError);

      await expect(repository.get({ id: '1' })).rejects.toEqual(retryableError);
      expect(mockDocClient.send).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = repository.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(typeof stats.size).toBe('number');
    });

    it('should work with cache disabled', async () => {
      const noCacheRepo = new TestRepository(undefined, false);
      const testEntity: TestEntity = { id: '1', name: 'Test', value: 100 };
      
      mockDocClient.send.mockResolvedValue({
        Item: testEntity,
      });

      // Multiple calls should always hit database when cache is disabled
      await noCacheRepo.get({ id: '1' });
      await noCacheRepo.get({ id: '1' });
      
      expect(mockDocClient.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('buildUpdateExpression', () => {
    it('should build update expression correctly', () => {
      const updates = {
        name: 'Updated Name',
        value: 500,
        description: 'New description',
      };
      
      const expression = (repository as any).buildUpdateExpression(updates);
      
      expect(expression.expression).toContain('SET');
      expect(expression.names).toBeDefined();
      expect(expression.values).toBeDefined();
      expect(Object.keys(expression.names)).toHaveLength(3);
      expect(Object.keys(expression.values)).toHaveLength(3);
    });

    it('should handle undefined values', () => {
      const updates = {
        name: 'Updated Name',
        value: undefined,
        description: 'New description',
      };
      
      const expression = (repository as any).buildUpdateExpression(updates);
      
      expect(Object.keys(expression.names)).toHaveLength(2);
      expect(Object.keys(expression.values)).toHaveLength(2);
    });
  });
});