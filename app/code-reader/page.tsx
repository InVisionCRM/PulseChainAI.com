import type { Metadata } from 'next';
import { Suspense } from 'react';
import CodeReader from '@/components/code-reader/CodeReader';

export const metadata: Metadata = {
  title: 'AI Code Reader',
  description:
    'Read any PulseChain contract — its verified source, every function, and an AI you can ask about it.',
};

export default function CodeReaderPage() {
  // The reader takes its contract from ?address=, and useSearchParams needs a
  // Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <CodeReader />
    </Suspense>
  );
}
