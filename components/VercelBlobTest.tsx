"use client";
import { useState } from 'react';
import { useVercelBlob } from '@/hooks/useVercelBlob';

export default function VercelBlobTest() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const { uploadFile, isUploading, error, uploadProgress } = useVercelBlob();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const result = await uploadFile(selectedFile);
    if (result) {
      setUploadedUrl(result.url);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Vercel Blob Test</h2>
      
      <div className="mb-4">
        <input
          type="file"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-slate-950 hover:file:bg-blue-100"
        />
      </div>

      {selectedFile && (
        <div className="mb-4 p-3 bg-gray-100 rounded">
          <p className="text-sm">
            <strong>Selected:</strong> {selectedFile.name}
          </p>
          <p className="text-sm text-gray-600">
            Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className="w-full bg-slate-950 text-white py-2 px-4 rounded hover:bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? 'Uploading...' : 'Upload to Vercel Blob'}
      </button>

      {isUploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-slate-950 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-center mt-2">{uploadProgress}%</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {uploadedUrl && (
        <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          <p className="font-semibold">Upload Successful!</p>
          <p className="text-sm break-all mt-2">{uploadedUrl}</p>
        </div>
      )}
    </div>
  );
}
