import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PulseChain Contract Analyzer',
  description: 'A Next.js application to analyze PulseChain Solidity smart contracts using AI. Input a contract address to view its source code and ask questions about its functionality, security, and logic.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-900 font-sans">{children}</body>
    </html>
  );
}
