"use client";
import GlobalFooter from "@/components/GlobalFooter";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full min-h-screen w-full">
      <div className="flex-1">
        {children}
      </div>
      <GlobalFooter />
    </div>
  );
}
