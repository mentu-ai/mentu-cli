import { Command } from 'commander';
import { MentuError } from '../types.js';
import { searchMemory, SearchResult } from '../memory/search.js';

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'search' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

function formatResults(results: SearchResult[], verbose: boolean): void {
  if (results.length === 0) {
    console.log('No results found.');
    return;
  }
  console.log(`Found ${results.length} results:\n`);
  for (const result of results) {
    console.log('-------------------------------------');
    console.log(`Memory: ${result.memoryId}`);
    console.log(`Score: ${result.score.toFixed(3)} (${result.matchType})`);
    if (verbose && result.chunkIndex !== undefined) {
      console.log(`Chunk: ${result.chunkIndex}`);
    }
    const snippet = result.content.slice(0, 200);
    console.log(`\n${snippet}${result.content.length > 200 ? '...' : ''}\n`);
  }
}

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search memories with hybrid vector and keyword matching')
    .option('-l, --limit <number>', 'Max results', (value: string) => parseInt(value, 10))
    .option('--vector-weight <number>', 'Vector score weight', (value: string) => parseFloat(value))
    .option('--text-weight <number>', 'Keyword score weight', (value: string) => parseFloat(value))
    .option('--min-score <number>', 'Minimum score threshold', (value: string) => parseFloat(value))
    .option('-v, --verbose', 'Show chunk metadata')
    .action(async (query: string, options: Record<string, unknown>) => {
      const json = (program.opts() as Record<string, unknown>).json as boolean || false;
      try {
        if (!query || query.trim() === '') {
          throw new MentuError('E_EMPTY_BODY', 'Query cannot be empty', { field: 'query' });
        }
        const searchOptions = {
          maxResults: Number.isFinite(options.limit) ? options.limit as number : undefined,
          vectorWeight: Number.isFinite(options.vectorWeight) ? options.vectorWeight as number : undefined,
          textWeight: Number.isFinite(options.textWeight) ? options.textWeight as number : undefined,
          minScore: Number.isFinite(options.minScore) ? options.minScore as number : undefined,
        };
        if (!json) {
          console.log(`Searching for: "${query}"\n`);
        }
        const results = await searchMemory(query, searchOptions);
        if (json) {
          console.log(JSON.stringify({
            query,
            results,
          }));
        } else {
          formatResults(results, (options.verbose as boolean) ?? false);
        }
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError('E_INVALID_OP', err instanceof Error ? err.message : 'Unknown error');
          outputError(error, json);
        }
      }
    });
}
