import VercelBlobTest from '@/components/VercelBlobTest';

export default function TestVercelBlobPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">Vercel Blob Integration Test</h1>
        <VercelBlobTest />
      </div>
    </div>
  );
}
