import { put, del, list } from '@vercel/blob';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export interface BlobUploadResponse {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
}

export interface BlobListResponse {
  blobs: BlobUploadResponse[];
  cursor?: string;
  hasMore: boolean;
}

/**
 * Upload a file to Vercel Blob
 */
export async function uploadToBlob(
  file: File | Buffer,
  filename?: string
): Promise<BlobUploadResponse> {
  try {
    const blob = await put(filename || 'file', file, {
      access: 'public',
    });
    
    return {
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    };
  } catch (error) {
    console.error('Error uploading to Vercel Blob:', error);
    throw new Error('Failed to upload file to Vercel Blob');
  }
}

/**
 * Delete a file from Vercel Blob
 */
export async function deleteFromBlob(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    console.error('Error deleting from Vercel Blob:', error);
    throw new Error('Failed to delete file from Vercel Blob');
  }
}

/**
 * List files from Vercel Blob
 */
export async function listFromBlob(
  cursor?: string,
  limit: number = 100
): Promise<BlobListResponse> {
  try {
    const { blobs, cursor: nextCursor, hasMore } = await list({
      limit,
      cursor,
    });
    
    return {
      blobs: blobs.map(blob => ({
        url: blob.url,
        pathname: blob.pathname,
        contentType: blob.contentType,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
      })),
      cursor: nextCursor,
      hasMore,
    };
  } catch (error) {
    console.error('Error listing from Vercel Blob:', error);
    throw new Error('Failed to list files from Vercel Blob');
  }
}

/**
 * Upload a local file to Vercel Blob
 */
export async function uploadLocalFileToBlob(
  filePath: string,
  filename?: string
): Promise<BlobUploadResponse> {
  try {
    const fileBuffer = await writeFile(filePath);
    const name = filename || filePath.split('/').pop() || 'file';
    
    return await uploadToBlob(fileBuffer, name);
  } catch (error) {
    console.error('Error uploading local file to Vercel Blob:', error);
    throw new Error('Failed to upload local file to Vercel Blob');
  }
}
