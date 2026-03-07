/**
 * Visual Pathway Agent Types
 *
 * Types for replaying recorded behaviors and capturing visual evidence.
 */

// Viewport configuration for multi-resolution screenshots
export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

// Default viewport presets
export const VIEWPORT_PRESETS: Record<string, ViewportConfig> = {
  desktop: {
    name: 'desktop',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
  },
  laptop: {
    name: 'laptop',
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    isMobile: false,
  },
  tablet: {
    name: 'tablet',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  mobile: {
    name: 'mobile',
    width: 375,
    height: 812,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};

// Screenshot capture result
export interface ScreenshotCapture {
  stepIndex: number;
  step: PathwayStep;
  viewport: string;
  localPath: string;
  supabasePath?: string;
  supabaseUrl?: string;
  timestamp: string;
  fileSize: number;
  dimensions: {
    width: number;
    height: number;
  };
}

// Pathway step from recording
export interface PathwayStep {
  action: string;
  url?: string;
  selector?: string;
  value?: string;
  timestamp?: number;
  timeout?: number;
  description?: string;
}

// Pathway recording input
export interface PathwayRecording {
  name: string;
  target: string;
  steps: PathwayStep[];
  cookies?: any[];
}

// Agent run options
export interface VisualPathwayOptions {
  pathwayName: string;
  recordingPath: string;
  viewports: string[];
  supabaseBucket: string;
  headless: boolean;
  screenshotFormat: 'png' | 'jpeg' | 'webp';
  screenshotQuality: number;
  waitBetweenSteps: number;
  commitmentId?: string;
  cookiesPath?: string;
}

// Agent run result
export interface VisualPathwayResult {
  success: boolean;
  pathwayName: string;
  recording: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  totalSteps: number;
  totalScreenshots: number;
  viewports: string[];
  screenshots: ScreenshotCapture[];
  errors: string[];
  supabaseFolder: string;
  evidenceId?: string;
}

// Supabase upload result
export interface SupabaseUploadResult {
  success: boolean;
  path: string;
  publicUrl?: string;
  error?: string;
}
