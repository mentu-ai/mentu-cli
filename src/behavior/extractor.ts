/**
 * Behavior Extractor
 *
 * Converts BehaviorRecording to YAML specification files.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import type { BehaviorRecording, BehaviorYAML } from './types.js';

// Sanitize name to prevent path traversal
function sanitizeName(name: string): string {
  return name.replace(/[\/\\:*?"<>|]/g, '-').replace(/\.\./g, '');
}

export interface ExtractorOptions {
  outputPath?: string;
  includeCookiesPath?: boolean;
  includeReplayDefaults?: boolean;
}

export function extractToYAML(
  recording: BehaviorRecording,
  options: ExtractorOptions = {}
): string {
  const {
    includeCookiesPath = true,
    includeReplayDefaults = true,
  } = options;

  // Convert recording to YAML structure
  const behaviorYAML: BehaviorYAML = {
    behavior: {
      name: recording.name,
      target: recording.target,
      version: recording.version,
      created: recording.created,
      steps: recording.steps.map((step) => ({
        action: step.action,
        ...(step.selector && { selector: step.selector }),
        ...(step.value && { value: step.value }),
        ...(step.url && { url: step.url }),
        ...(step.condition && { condition: step.condition }),
        ...(step.timeout && { timeout: step.timeout }),
        ...(step.description && { description: step.description }),
      })),
      evidence: recording.evidence?.map((ev) => ({
        name: ev.name,
        type: ev.type,
        description: `Captured at ${ev.timestamp}`,
      })),
    },
  };

  // Add cookies reference if available
  if (includeCookiesPath && recording.cookies && recording.cookies.length > 0) {
    const domain = new URL(recording.target).hostname.replace(/^www\./, '').replace(/\./g, '-');
    behaviorYAML.cookies = {
      path: `~/.mentu/cookies/${domain}.json`,
      domain: new URL(recording.target).hostname,
    };
  }

  // Add replay defaults
  if (includeReplayDefaults) {
    behaviorYAML.replay = {
      headless: true,
      viewport: '1280x720',
      timeout: 30000,
    };
  }

  return yaml.stringify(behaviorYAML, {
    indent: 2,
    lineWidth: 0,
  });
}

export function saveRecording(
  recording: BehaviorRecording,
  outputDir: string,
  options: ExtractorOptions = {}
): { yamlPath: string; jsonPath: string } {
  const baseName = sanitizeName(recording.name);
  const yamlPath = path.join(outputDir, `${baseName}.yaml`);
  const jsonPath = path.join(outputDir, `${baseName}.json`);

  // Ensure directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Save YAML (human-readable, for replay)
  const yamlContent = extractToYAML(recording, options);
  fs.writeFileSync(yamlPath, yamlContent);

  // Save JSON (complete recording with all metadata)
  fs.writeFileSync(jsonPath, JSON.stringify(recording, null, 2));

  console.log(`Saved YAML: ${yamlPath}`);
  console.log(`Saved JSON: ${jsonPath}`);

  return { yamlPath, jsonPath };
}

export function loadBehaviorYAML(yamlPath: string): BehaviorYAML {
  const content = fs.readFileSync(yamlPath, 'utf-8');
  return yaml.parse(content) as BehaviorYAML;
}
