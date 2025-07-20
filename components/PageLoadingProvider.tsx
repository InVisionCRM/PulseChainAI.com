"use client";
import { usePageLoading } from "@/lib/hooks/usePageLoading";
import LoadingScreen from "@/components/ui/loading-screen";

interface PageLoadingProviderProps {
  children: React.ReactNode;
}

export default function PageLoadingProvider({ children }: PageLoadingProviderProps) {
  const { isLoading } = usePageLoading();

  return (
    <>
      {children}
      <LoadingScreen 
        isVisible={isLoading} 
        message="" 
      />
    </>
  );
} 