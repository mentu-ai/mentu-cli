/**
 * Visual Pathway Agent
 *
 * Agent that replays recorded browser pathways and captures visual evidence.
 * Uploads screenshots to Supabase and returns a JSON manifest.
 */

export { runVisualPathway, VisualPathwayRunner } from './runner.js';
export { VisualStorage } from './storage.js';
export * from './types.js';
