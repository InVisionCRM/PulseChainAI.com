"use client";

import Link from "next/link";
import { IconHome, IconArrowLeft } from "@tabler/icons-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--panel)] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl font-bold text-[var(--text)] mb-4">404</div>
        <h1 className="text-2xl font-bold text-[var(--text)] mb-4">Page Not Found</h1>
        <p className="text-[var(--text-muted)] mb-8 max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-[var(--text)] rounded-lg hover:bg-orange-600 transition-colors"
          >
            <IconHome className="h-5 w-5" />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface-2)] text-[var(--text)] rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          >
            <IconArrowLeft className="h-5 w-5" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}