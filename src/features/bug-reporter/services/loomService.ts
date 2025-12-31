/**
 * Loom Service (Stubbed)
 *
 * Loom recording integration is disabled in this build.
 * URL parsing utilities are still available for handling existing Loom URLs.
 */

// Types for Loom video (kept for compatibility)
export interface LoomVideo {
  id: string;
  title: string;
  height: number;
  width: number;
  sharedUrl: string;
  embedUrl: string;
  providerUrl: string;
}

export interface LoomSDKInstance {
  configureButton: (config: {
    element: HTMLElement;
    hooks?: {
      onStart?: () => void;
      onCancel?: () => void;
      onComplete?: (video: LoomVideo) => void;
      onRecordingStart?: () => void;
      onUploadComplete?: (video: LoomVideo) => void;
    };
  }) => void;
  openPreRecordPanel: () => void;
}

export const LoomService = {
  /**
   * Loom SDK is disabled in this build
   */
  isSupported: (): boolean => {
    return false;
  },

  /**
   * Loom is not configured (SDK removed)
   */
  isConfigured: (): boolean => {
    return false;
  },

  /**
   * SDK initialization is disabled
   */
  async initialize(): Promise<LoomSDKInstance> {
    throw new Error('Loom SDK is not available in this build');
  },

  /**
   * Extension check is disabled
   */
  async checkExtensionInstalled(): Promise<boolean> {
    return false;
  },

  /**
   * Open Chrome Web Store page for Loom extension
   */
  openExtensionStore(): void {
    window.open(
      'https://chromewebstore.google.com/detail/loom-screen-recorder-sc/liecbddmkiiihnedobmlmillhodjkdmb',
      '_blank'
    );
  },

  /**
   * Extract video ID from a Loom share URL
   */
  extractVideoId(url: string): string | null {
    const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  },

  /**
   * Validate if URL is a Loom video URL
   */
  isLoomUrl(url: string): boolean {
    return /loom\.com\/share\/[a-zA-Z0-9]+/.test(url);
  },

  /**
   * Get embed URL from share URL
   */
  getEmbedUrl(shareUrl: string): string | null {
    const videoId = this.extractVideoId(shareUrl);
    if (!videoId) return null;
    return `https://www.loom.com/embed/${videoId}`;
  },
};
