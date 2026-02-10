// Export all repository classes and interfaces
export { BaseRepository } from './base-repository';
export type { RetryConfig, CacheEntry } from './base-repository';

export { HeritageSitesRepository } from './heritage-sites-repository';
export { ArtifactsRepository } from './artifacts-repository';
export { UserSessionsRepository } from './user-sessions-repository';
export { ContentCacheRepository } from './content-cache-repository';
export type { CachedContent } from './content-cache-repository';

// Import repository classes for factory (after exports to avoid circular dependency)
import type { HeritageSitesRepository } from './heritage-sites-repository';
import type { ArtifactsRepository } from './artifacts-repository';
import type { UserSessionsRepository } from './user-sessions-repository';
import type { ContentCacheRepository } from './content-cache-repository';

// Repository factory for dependency injection
export class RepositoryFactory {
  private static heritageSitesRepository: HeritageSitesRepository | null = null;
  private static artifactsRepository: ArtifactsRepository | null = null;
  private static userSessionsRepository: UserSessionsRepository | null = null;
  private static contentCacheRepository: ContentCacheRepository | null = null;

  /**
   * Get Heritage Sites repository instance (singleton)
   */
  public static getHeritageSitesRepository(): HeritageSitesRepository {
    if (!this.heritageSitesRepository) {
      const { HeritageSitesRepository: Repo } = require('./heritage-sites-repository');
      this.heritageSitesRepository = new Repo();
    }
    return this.heritageSitesRepository!;
  }

  /**
   * Get Artifacts repository instance (singleton)
   */
  public static getArtifactsRepository(): ArtifactsRepository {
    if (!this.artifactsRepository) {
      const { ArtifactsRepository: Repo } = require('./artifacts-repository');
      this.artifactsRepository = new Repo();
    }
    return this.artifactsRepository!;
  }

  /**
   * Get User Sessions repository instance (singleton)
   */
  public static getUserSessionsRepository(): UserSessionsRepository {
    if (!this.userSessionsRepository) {
      const { UserSessionsRepository: Repo } = require('./user-sessions-repository');
      this.userSessionsRepository = new Repo();
    }
    return this.userSessionsRepository!;
  }

  /**
   * Get Content Cache repository instance (singleton)
   */
  public static getContentCacheRepository(): ContentCacheRepository {
    if (!this.contentCacheRepository) {
      const { ContentCacheRepository: Repo } = require('./content-cache-repository');
      this.contentCacheRepository = new Repo();
    }
    return this.contentCacheRepository!;
  }

  /**
   * Reset all repository instances (useful for testing)
   */
  public static resetInstances(): void {
    this.heritageSitesRepository = null;
    this.artifactsRepository = null;
    this.userSessionsRepository = null;
    this.contentCacheRepository = null;
  }
}