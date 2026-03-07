import { MentuError } from '../types.js';

export interface SearchOptions {
  maxResults?: number;
  vectorWeight?: number;
  textWeight?: number;
  minScore?: number;
}

export interface SearchResult {
  memoryId: string;
  score: number;
  matchType: string;
  content: string;
  chunkIndex?: number;
}

export async function searchMemory(
  _query: string,
  _options?: SearchOptions
): Promise<SearchResult[]> {
  throw new MentuError(
    'E_INVALID_OP',
    'Memory search is not yet available — requires vector index setup'
  );
}
