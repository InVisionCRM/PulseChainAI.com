import { useState, useCallback } from 'react';
import { BlobUploadResponse } from '@/lib/vercel-blob';

interface UseVercelBlobReturn {
  uploadFile: (file: File) => Promise<BlobUploadResponse | null>;
  isUploading: boolean;
  error: string | null;
  uploadProgress: number;
}

export function useVercelBlob(): UseVercelBlobReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = useCallback(async (file: File): Promise<BlobUploadResponse | null> => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/blob/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadProgress(100);
      
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    uploadFile,
    isUploading,
    error,
    uploadProgress,
  };
}
