/**
 * Browser Behavior Recording Types
 *
 * Types for recording, extracting, and replaying user browser behavior.
 */

// Cookie type (from Puppeteer)
export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  size: number;
  httpOnly: boolean;
  secure: boolean;
  session: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

// Actions that can be recorded
export type BehaviorAction =
  | 'navigate'
  | 'click'
  | 'type'
  | 'wait'
  | 'screenshot'
  | 'scroll'
  | 'select'
  | 'hover';

// Wait conditions
export type WaitCondition =
  | 'selector'
  | 'url-contains'
  | 'network-idle'
  | 'timeout';

// A single recorded step
export interface BehaviorStep {
  action: BehaviorAction;
  timestamp: number;
  selector?: string;
  value?: string;
  url?: string;
  condition?: WaitCondition;
  timeout?: number;
  description?: string;
}

// Evidence capture during recording/replay
export interface EvidenceCapture {
  name: string;
  type: 'screenshot' | 'cookie' | 'dom-snapshot';
  path?: string;
  timestamp: string;
  commitmentId?: string;
  memoryId?: string;
}

// Complete recording
export interface BehaviorRecording {
  name: string;
  target: string;
  created: string;
  version: string;
  steps: BehaviorStep[];
  cookies?: Cookie[];
  evidence?: EvidenceCapture[];
  metadata?: Record<string, unknown>;
}

// Options for replay
export interface ReplayOptions {
  headless: boolean;
  viewport: { width: number; height: number };
  timeout: number;
  evidenceDir: string;
  commitmentId?: string;
  cookiesPath?: string;
  slowMo?: number;
}

// A step from YAML (no timestamp required)
export interface BehaviorYAMLStep {
  action: BehaviorAction;
  selector?: string;
  value?: string;
  url?: string;
  condition?: WaitCondition;
  timeout?: number;
  description?: string;
}

// Result of a single step replay
export interface StepResult {
  step: BehaviorYAMLStep;
  success: boolean;
  duration: number;
  screenshot?: string;
  error?: string;
}

// Complete replay result
export interface ReplayResult {
  success: boolean;
  recording: string;
  steps: StepResult[];
  evidence: EvidenceCapture[];
  duration: number;
  errors: string[];
}

// Recording state machine
export type RecordingState =
  | 'idle'
  | 'recording'
  | 'extracted'
  | 'replaying'
  | 'success'
  | 'failed'
  | 'aborted';

// Recorder options
export interface RecorderOptions {
  target: string;
  name?: string;
  cookiesPath?: string;
  outputDir?: string;
  timeout?: number;
  autoSaveDelay?: number; // Auto-save after this many ms (0 = wait for ENTER)
}

// YAML behavior specification (output format)
export interface BehaviorYAML {
  behavior: {
    name: string;
    target: string;
    version: string;
    created: string;
    steps: BehaviorYAMLStep[];
    evidence?: Array<{
      name: string;
      type: string;
      selector?: string;
      description?: string;
    }>;
  };
  cookies?: {
    path: string;
    domain: string;
  };
  replay?: {
    headless: boolean;
    viewport: string;
    timeout: number;
  };
}
