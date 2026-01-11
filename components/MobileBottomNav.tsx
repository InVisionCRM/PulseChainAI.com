"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconHome, IconCoin, IconArrowsRightLeft, IconDots } from "@tabler/icons-react";
import { NavigationDrawer } from "./NavigationDrawer";

type NavItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  external?: boolean;
  isAction?: boolean;
};

export const MobileBottomNav = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Get current token address from URL params if on geicko page
  const currentTokenAddress = pathname === '/geicko' ? searchParams.get('address') : null;

  // WPLS address as fallback
  const WPLS_ADDRESS = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27';

  const handleSwapClick = () => {
    const tokenAddress = currentTokenAddress || WPLS_ADDRESS;
    router.push(`/geicko?address=${tokenAddress}&tab=switch`);
  };

  const navItems: NavItem[] = [
    {
      label: "Home",
      href: "/",
      icon: <IconHome className="h-5 w-5" />,
    },
    {
      label: "Tokens",
      href: "/#tokentable",
      icon: <IconCoin className="h-5 w-5" />,
    },
    {
      label: "Swap",
      onClick: handleSwapClick,
      icon: <IconArrowsRightLeft className="h-5 w-5" />,
      isAction: true,
    },
  ];

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[#2C3E50] via-[#34495E] to-[#3B6978] border-t border-orange-500/40 backdrop-blur-xl">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = item.href ? pathname === item.href : false;
            const content = (
              <div
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "text-orange-500"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {item.icon}
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            );

            // Handle action buttons (like swap) differently
            if (item.isAction && item.onClick) {
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg text-white/70 hover:text-white transition-colors"
                >
                  {content}
                </button>
              );
            }

            if (item.external) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {content}
                </a>
              );
            }

            return (
              <Link key={item.label} href={item.href}>
                {content}
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg text-white/70 hover:text-white transition-colors"
          >
            <IconDots className="h-5 w-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Navigation Drawer */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
};
