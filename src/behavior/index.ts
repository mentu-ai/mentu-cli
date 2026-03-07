/**
 * Browser Behavior Recording Module
 *
 * Record, extract, and replay user browser behavior.
 */

// Types
export type {
  Cookie,
  BehaviorAction,
  WaitCondition,
  BehaviorStep,
  BehaviorYAMLStep,
  EvidenceCapture,
  BehaviorRecording,
  ReplayOptions,
  StepResult,
  ReplayResult,
  RecordingState,
  RecorderOptions,
  BehaviorYAML,
} from './types.js';

// Recorder
export { BehaviorRecorder, recordBehavior } from './recorder.js';

// Extractor
export {
  extractToYAML,
  saveRecording,
  loadBehaviorYAML,
  type ExtractorOptions,
} from './extractor.js';

// Replayer
export { BehaviorReplayer, replayBehavior } from './replayer.js';
