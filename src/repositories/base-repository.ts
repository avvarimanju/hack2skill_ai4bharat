// Base repository class with common DynamoDB operations and error handling
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
  GetCommandInput,
  PutCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  QueryCommandInput,
  ScanCommandInput,
  BatchGetCommandInput,
  BatchWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from '../utils/aws-clients';
import { logger } from '../utils/logger';
import { DynamoDBError, isDynamoDBError } from '../models/aws-types';
import { ValidationResult } from '../models/common';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export abstract class BaseRepository<T extends Record<string, any>> {
  protected tableName: string;
  protected retryConfig: RetryConfig;
  protected cache: Map<string, CacheEntry<T>>;
  protected cacheEnabled: boolean;
  protected defaultCacheTtl: number;

  constructor(
    tableName: string,
    retryConfig: RetryConfig = {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
    },
    cacheEnabled: boolean = true,
    defaultCacheTtl: number = 300000 // 5 minutes
  ) {
    this.tableName = tableName;
    this.retryConfig = retryConfig;
    this.cache = new Map();
    this.cacheEnabled = cacheEnabled;
    this.defaultCacheTtl = defaultCacheTtl;
  }

  /**
   * Abstract method to validate entity before operations
   */
  protected abstract validateEntity(entity: T): ValidationResult;

  /**
   * Abstract method to get the primary key for an entity
   */
  protected abstract getPrimaryKey(entity: T): Record<string, any>;

  /**
   * Abstract method to get cache key for an entity
   */
  protected abstract getCacheKey(key: Record<string, any>): string;

  /**
   * Execute operation with retry logic and error handling
   */
  protected async executeWithRetry<R>(
    operation: () => Promise<R>,
    operationName: string,
    context?: Record<string, any>
  ): Promise<R> {
    let lastError: Error | undefined;
    let delay = this.retryConfig.baseDelayMs;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 0) {
          logger.info(`Operation ${operationName} succeeded after ${attempt} retries`, {
            tableName: this.tableName,
            attempt,
            context,
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        logger.warn(`Operation ${operationName} failed on attempt ${attempt + 1}`, {
          tableName: this.tableName,
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : String(error),
          context,
        });

        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Wait before retry with exponential backoff
        await this.sleep(Math.min(delay, this.retryConfig.maxDelayMs));
        delay *= this.retryConfig.backoffMultiplier;
      }
    }

    logger.error(`Operation ${operationName} failed after ${this.retryConfig.maxRetries + 1} attempts`, {
      tableName: this.tableName,
      error: lastError?.message || 'Unknown error',
      context,
    });

    throw lastError || new Error('Operation failed with unknown error');
  }

  /**
   * Check if error is retryable
   */
  protected isRetryableError(error: any): boolean {
    if (isDynamoDBError(error)) {
      return [
        'ProvisionedThroughputExceededException',
        'ThrottlingException',
        'RequestLimitExceeded',
        'LimitExceededException',
      ].includes(error.code);
    }
    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get item from cache
   */
  protected getCachedItem(cacheKey: string): T | null {
    if (!this.cacheEnabled) {
      return null;
    }

    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data;
  }

  /**
   * Set item in cache
   */
  protected setCachedItem(cacheKey: string, data: T, ttl?: number): void {
    if (!this.cacheEnabled) {
      return;
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultCacheTtl,
    };

    this.cache.set(cacheKey, entry);
  }

  /**
   * Remove item from cache
   */
  protected removeCachedItem(cacheKey: string): void {
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache entries
   */
  protected clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.cache.size,
      // Hit rate would need to be tracked separately if needed
    };
  }

  /**
   * Get item by primary key
   */
  public async get(key: Record<string, any>): Promise<T | null> {
    const cacheKey = this.getCacheKey(key);
    
    // Check cache first
    const cachedItem = this.getCachedItem(cacheKey);
    if (cachedItem) {
      logger.debug('Cache hit for get operation', {
        tableName: this.tableName,
        cacheKey,
      });
      return cachedItem;
    }

    const params: GetCommandInput = {
      TableName: this.tableName,
      Key: key,
    };

    const result = await this.executeWithRetry(
      async () => {
        const command = new GetCommand(params);
        return await docClient.send(command);
      },
      'get',
      { key }
    );

    const item = result.Item as T | undefined;
    
    if (item) {
      this.setCachedItem(cacheKey, item);
    }

    return item || null;
  }

  /**
   * Put item
   */
  public async put(item: T, options?: { overwrite?: boolean }): Promise<void> {
    const validation = this.validateEntity(item);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
    }

    const params: PutCommandInput = {
      TableName: this.tableName,
      Item: item,
    };

    if (options?.overwrite === false) {
      const key = this.getPrimaryKey(item);
      const keyConditions = Object.keys(key).map(k => `attribute_not_exists(${k})`);
      params.ConditionExpression = keyConditions.join(' AND ');
    }

    await this.executeWithRetry(
      async () => {
        const command = new PutCommand(params);
        return await docClient.send(command);
      },
      'put',
      { item: this.getPrimaryKey(item) }
    );

    // Update cache
    const cacheKey = this.getCacheKey(this.getPrimaryKey(item));
    this.setCachedItem(cacheKey, item);
  }

  /**
   * Update item
   */
  public async update(
    key: Record<string, any>,
    updates: Record<string, any>,
    options?: { returnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW' }
  ): Promise<T | null> {
    const updateExpression = this.buildUpdateExpression(updates);
    
    const params: UpdateCommandInput = {
      TableName: this.tableName,
      Key: key,
      UpdateExpression: updateExpression.expression,
      ExpressionAttributeNames: updateExpression.names,
      ExpressionAttributeValues: updateExpression.values,
      ReturnValues: options?.returnValues || 'ALL_NEW',
    };

    const result = await this.executeWithRetry(
      async () => {
        const command = new UpdateCommand(params);
        return await docClient.send(command);
      },
      'update',
      { key, updates }
    );

    const updatedItem = result.Attributes as T | undefined;
    
    if (updatedItem) {
      // Update cache
      const cacheKey = this.getCacheKey(key);
      this.setCachedItem(cacheKey, updatedItem);
    } else {
      // Remove from cache if item was deleted or not returned
      const cacheKey = this.getCacheKey(key);
      this.removeCachedItem(cacheKey);
    }

    return updatedItem || null;
  }

  /**
   * Delete item
   */
  public async delete(key: Record<string, any>): Promise<T | null> {
    const params: DeleteCommandInput = {
      TableName: this.tableName,
      Key: key,
      ReturnValues: 'ALL_OLD',
    };

    const result = await this.executeWithRetry(
      async () => {
        const command = new DeleteCommand(params);
        return await docClient.send(command);
      },
      'delete',
      { key }
    );

    // Remove from cache
    const cacheKey = this.getCacheKey(key);
    this.removeCachedItem(cacheKey);

    return (result.Attributes as T) || null;
  }

  /**
   * Query items
   */
  public async query(params: Omit<QueryCommandInput, 'TableName'>): Promise<T[]> {
    const queryParams: QueryCommandInput = {
      ...params,
      TableName: this.tableName,
    };

    const result = await this.executeWithRetry(
      async () => {
        const command = new QueryCommand(queryParams);
        return await docClient.send(command);
      },
      'query',
      { params }
    );

    return (result.Items as T[]) || [];
  }

  /**
   * Scan items
   */
  public async scan(params?: Omit<ScanCommandInput, 'TableName'>): Promise<T[]> {
    const scanParams: ScanCommandInput = {
      ...params,
      TableName: this.tableName,
    };

    const result = await this.executeWithRetry(
      async () => {
        const command = new ScanCommand(scanParams);
        return await docClient.send(command);
      },
      'scan',
      { params }
    );

    return (result.Items as T[]) || [];
  }

  /**
   * Batch get items
   */
  public async batchGet(keys: Record<string, any>[]): Promise<T[]> {
    if (keys.length === 0) {
      return [];
    }

    // Check cache for items first
    const cachedItems: T[] = [];
    const uncachedKeys: Record<string, any>[] = [];

    for (const key of keys) {
      const cacheKey = this.getCacheKey(key);
      const cachedItem = this.getCachedItem(cacheKey);
      if (cachedItem) {
        cachedItems.push(cachedItem);
      } else {
        uncachedKeys.push(key);
      }
    }

    if (uncachedKeys.length === 0) {
      return cachedItems;
    }

    const params: BatchGetCommandInput = {
      RequestItems: {
        [this.tableName]: {
          Keys: uncachedKeys,
        },
      },
    };

    const result = await this.executeWithRetry(
      async () => {
        const command = new BatchGetCommand(params);
        return await docClient.send(command);
      },
      'batchGet',
      { keyCount: uncachedKeys.length }
    );

    const items = (result.Responses?.[this.tableName] as T[]) || [];
    
    // Cache the retrieved items
    for (const item of items) {
      const key = this.getPrimaryKey(item);
      const cacheKey = this.getCacheKey(key);
      this.setCachedItem(cacheKey, item);
    }

    return [...cachedItems, ...items];
  }

  /**
   * Batch write items (put and delete operations)
   */
  public async batchWrite(
    puts: T[] = [],
    deletes: Record<string, any>[] = []
  ): Promise<void> {
    if (puts.length === 0 && deletes.length === 0) {
      return;
    }

    // Validate put items
    for (const item of puts) {
      const validation = this.validateEntity(item);
      if (!validation.isValid) {
        throw new Error(`Validation failed for batch put: ${validation.errors?.join(', ')}`);
      }
    }

    const writeRequests = [
      ...puts.map(item => ({
        PutRequest: {
          Item: item,
        },
      })),
      ...deletes.map(key => ({
        DeleteRequest: {
          Key: key,
        },
      })),
    ];

    const params: BatchWriteCommandInput = {
      RequestItems: {
        [this.tableName]: writeRequests,
      },
    };

    await this.executeWithRetry(
      async () => {
        const command = new BatchWriteCommand(params);
        return await docClient.send(command);
      },
      'batchWrite',
      { putCount: puts.length, deleteCount: deletes.length }
    );

    // Update cache
    for (const item of puts) {
      const key = this.getPrimaryKey(item);
      const cacheKey = this.getCacheKey(key);
      this.setCachedItem(cacheKey, item);
    }

    for (const key of deletes) {
      const cacheKey = this.getCacheKey(key);
      this.removeCachedItem(cacheKey);
    }
  }

  /**
   * Build update expression from updates object
   */
  protected buildUpdateExpression(updates: Record<string, any>): {
    expression: string;
    names: Record<string, string>;
    values: Record<string, any>;
  } {
    const setExpressions: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};

    let nameCounter = 0;
    let valueCounter = 0;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const nameKey = `#n${nameCounter++}`;
        const valueKey = `:v${valueCounter++}`;
        
        names[nameKey] = key;
        values[valueKey] = value;
        setExpressions.push(`${nameKey} = ${valueKey}`);
      }
    }

    return {
      expression: `SET ${setExpressions.join(', ')}`,
      names,
      values,
    };
  }
}