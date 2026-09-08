export interface LoadedBuildMetadata {
  name: string;
  tagline: string;
  description: string;
  packageVersion: string;
  buildId: string;
  version: string;
  contentPackVersion: string;
  buildString: string;
}

export function loadBuildMetadata(rootPath?: string): LoadedBuildMetadata;
