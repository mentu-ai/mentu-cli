/**
 * Visual Pathway Storage
 *
 * Handles screenshot uploads to Supabase Storage.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SupabaseUploadResult } from './types.js';

// Supabase configuration from environment
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.MENTU_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.MENTU_SUPABASE_KEY;

export class VisualStorage {
  private supabaseUrl: string;
  private supabaseKey: string;
  private bucket: string;

  constructor(bucket: string = 'visual-evidence') {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error(
        'Supabase configuration missing. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
      );
    }

    this.supabaseUrl = SUPABASE_URL;
    this.supabaseKey = SUPABASE_KEY;
    this.bucket = bucket;
  }

  /**
   * Upload a screenshot to Supabase Storage
   */
  async uploadScreenshot(
    localPath: string,
    remotePath: string
  ): Promise<SupabaseUploadResult> {
    try {
      const fileContent = fs.readFileSync(localPath);
      const contentType = this.getContentType(localPath);

      const url = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${remotePath}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: fileContent,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          path: remotePath,
          error: `Upload failed: ${response.status} - ${errorText}`,
        };
      }

      // Get public URL
      const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${remotePath}`;

      return {
        success: true,
        path: remotePath,
        publicUrl,
      };
    } catch (error) {
      return {
        success: false,
        path: remotePath,
        error: `Upload error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Upload multiple screenshots in parallel
   */
  async uploadBatch(
    uploads: Array<{ localPath: string; remotePath: string }>
  ): Promise<SupabaseUploadResult[]> {
    const results = await Promise.all(
      uploads.map(({ localPath, remotePath }) =>
        this.uploadScreenshot(localPath, remotePath)
      )
    );
    return results;
  }

  /**
   * Create a folder structure in storage
   */
  async createFolder(folderPath: string): Promise<boolean> {
    try {
      // Supabase creates folders automatically with the first upload
      // This is a no-op but we keep it for API consistency
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(folderPath: string): Promise<string[]> {
    try {
      const url = `${this.supabaseUrl}/storage/v1/object/list/${this.bucket}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: folderPath,
          limit: 1000,
        }),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.map((item: { name: string }) => item.name);
    } catch {
      return [];
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(remotePath: string): string {
    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${remotePath}`;
  }

  /**
   * Determine content type from file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      case '.json':
        return 'application/json';
      default:
        return 'application/octet-stream';
    }
  }
}
