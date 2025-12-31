/**
 * Screenshot Capture Utility
 * PRD: In-App Bug Reporting - Screenshot Capture
 *
 * Uses DOM-to-canvas rendering to capture the current viewport.
 * No browser permission required.
 *
 * Known limitations (per PRD):
 * - May not perfectly render cross-origin images
 * - Complex CSS effects may not render correctly
 * - Embedded iframes may not be captured
 */

/**
 * Configuration for screenshot capture
 */
interface ScreenshotOptions {
  scale?: number;
  quality?: number;
  format?: 'png' | 'jpeg';
  maxWidth?: number;
  maxHeight?: number;
  ignoreElements?: string[]; // CSS selectors to ignore
  timeout?: number;
}

const DEFAULT_OPTIONS: ScreenshotOptions = {
  scale: window.devicePixelRatio || 1,
  quality: 0.92,
  format: 'jpeg',
  maxWidth: 1920,
  maxHeight: 1080,
  timeout: 5000,
  ignoreElements: [
    '[data-bug-reporter-ignore]',
    '.bug-reporter-overlay',
    '.bug-reporter-modal',
  ],
};

/**
 * Check if html2canvas is available
 * The library should be lazy-loaded to avoid bundle size impact
 */
async function getHtml2Canvas(): Promise<typeof import('html2canvas')['default'] | null> {
  try {
    // Try to import html2canvas dynamically
    const module = await import('html2canvas');
    return module.default;
  } catch {
    console.warn('[BugReporter] html2canvas not available. Screenshot capture disabled.');
    return null;
  }
}

/**
 * Capture a screenshot of the current viewport
 * Returns a base64 encoded image string
 */
export async function captureScreenshot(
  options: Partial<ScreenshotOptions> = {}
): Promise<string | null> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const html2canvas = await getHtml2Canvas();

  if (!html2canvas) {
    // Fallback: return null if html2canvas is not available
    console.warn('[BugReporter] Screenshot capture skipped - html2canvas not loaded');
    return null;
  }

  return new Promise((resolve) => {
    // Set up timeout
    const timeoutId = setTimeout(() => {
      console.warn('[BugReporter] Screenshot capture timed out');
      resolve(null);
    }, config.timeout);

    try {
      // Determine what to capture
      const targetElement = document.body;

      // Create ignore function
      const ignoreElements = (element: Element): boolean => {
        if (!config.ignoreElements) return false;
        return config.ignoreElements.some((selector) => {
          try {
            return element.matches(selector);
          } catch {
            return false;
          }
        });
      };

      html2canvas(targetElement, {
        scale: config.scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        ignoreElements: ignoreElements,
      })
        .then((canvas) => {
          clearTimeout(timeoutId);

          // Resize if needed
          let finalCanvas = canvas;
          if (
            canvas.width > (config.maxWidth || Infinity) ||
            canvas.height > (config.maxHeight || Infinity)
          ) {
            finalCanvas = resizeCanvas(
              canvas,
              config.maxWidth || canvas.width,
              config.maxHeight || canvas.height
            );
          }

          // Convert to base64
          const format = config.format === 'png' ? 'image/png' : 'image/jpeg';
          const dataUrl = finalCanvas.toDataURL(format, config.quality);

          resolve(dataUrl);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          console.error('[BugReporter] Screenshot capture failed:', error);
          resolve(null);
        });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[BugReporter] Screenshot capture error:', error);
      resolve(null);
    }
  });
}

/**
 * Resize a canvas to fit within max dimensions while maintaining aspect ratio
 */
function resizeCanvas(
  canvas: HTMLCanvasElement,
  maxWidth: number,
  maxHeight: number
): HTMLCanvasElement {
  const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);

  if (ratio >= 1) {
    return canvas;
  }

  const newWidth = Math.floor(canvas.width * ratio);
  const newHeight = Math.floor(canvas.height * ratio);

  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = newWidth;
  resizedCanvas.height = newHeight;

  const ctx = resizedCanvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
  }

  return resizedCanvas;
}

/**
 * Capture a screenshot of a specific element
 */
export async function captureElementScreenshot(
  element: HTMLElement,
  options: Partial<ScreenshotOptions> = {}
): Promise<string | null> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const html2canvas = await getHtml2Canvas();

  if (!html2canvas) {
    return null;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(null);
    }, config.timeout);

    html2canvas(element, {
      scale: config.scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
    })
      .then((canvas) => {
        clearTimeout(timeoutId);
        const format = config.format === 'png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(format, config.quality));
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error('[BugReporter] Element screenshot failed:', error);
        resolve(null);
      });
  });
}

/**
 * Get screenshot as a Blob (for file upload scenarios)
 */
export async function captureScreenshotAsBlob(
  options: Partial<ScreenshotOptions> = {}
): Promise<Blob | null> {
  const dataUrl = await captureScreenshot(options);
  if (!dataUrl) return null;

  // Convert data URL to Blob
  try {
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch (error) {
    console.error('[BugReporter] Failed to convert screenshot to blob:', error);
    return null;
  }
}
