// /tx/[hash] — a PulseChain transaction, opened from the search bar.
//
// The receipt prints from the RPC pool (lib/pulsechainTx.ts loadTx). The
// explorer's names — the function called and the contract's name — stream in
// behind Suspense, so a slow or down explorer never holds the receipt back.

import { Suspense, cache, type ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { loadTx, loadTxNames } from '@/lib/pulsechainTx';
import { isTxHash } from '@/lib/pulsechainExplorer';
import { TxReceipt, VoidReceipt, ToName, Called, NamesPending, shortHex } from '@/components/tx/TxReceipt';

// A mined transaction never changes; a pending one settles within a minute.
export const revalidate = 60;

// Both explorer slots read the same response — one request per render.
const names = cache(loadTxNames);

export async function generateMetadata({ params }: { params: Promise<{ hash: string }> }): Promise<Metadata> {
  const { hash } = await params;
  return {
    title: isTxHash(hash) ? `PulseChain transaction ${shortHex(hash.toLowerCase())}` : 'PulseChain transaction',
    description: 'Status, tokens moved and network fee for a PulseChain transaction, read straight from the chain.',
  };
}

async function ToNameSlot({ hash }: { hash: string }) {
  const n = await names(hash);
  return <ToName name={n?.toName ?? null} />;
}

async function CalledSlot({ hash, selector }: { hash: string; selector: string }) {
  return <Called selector={selector} names={await names(hash)} />;
}

export default async function TxPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash: raw } = await params;
  const hash = raw.toLowerCase();

  let body: ReactNode;
  if (!isTxHash(hash)) {
    body = (
      <VoidReceipt
        hash={raw}
        reason="That isn't a transaction hash. A PulseChain transaction hash is 0x followed by 64 characters."
      />
    );
  } else {
    const view = await loadTx(hash);
    body = view ? (
      <TxReceipt
        view={view}
        toName={<Suspense fallback={null}><ToNameSlot hash={hash} /></Suspense>}
        called={
          view.selector ? (
            <Suspense fallback={<NamesPending />}><CalledSlot hash={hash} selector={view.selector} /></Suspense>
          ) : null
        }
      />
    ) : (
      <VoidReceipt
        hash={hash}
        reason="No PulseChain node returned this transaction. Check the hash was copied in full and that it's from PulseChain, not Ethereum. If it was only just sent, try again in a minute."
      />
    );
  }

  return (
    <main className="min-h-screen px-4 pb-16 pt-6 sm:pt-10">
      <div className="mx-auto w-full max-w-[440px]">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <IconArrowLeft className="h-3.5 w-3.5" /> Search
        </Link>
      </div>
      {body}
    </main>
  );
}
