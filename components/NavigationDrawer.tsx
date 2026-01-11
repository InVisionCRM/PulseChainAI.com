"use client";
import Link from "next/link";
import {
  IconBook,
  IconCurrencyDollar,
  IconChartBar,
  IconHeart,
  IconMail,
  IconPhoneOutgoing,
  IconRocket as IconHextroids,
  IconDeviceGamepad2,
  IconX,
} from "@tabler/icons-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NavigationDrawer = ({ isOpen, onClose }: NavigationDrawerProps) => {
  const handleOpenChange = (open: boolean) => {
    if (!open && onClose) {
      onClose();
    }
  };

  const moreNavItems = [
    {
      label: "HEX Dashboard",
      href: "/hex-dashboard",
      icon: (
        <img
          src="/HEXagon (1).svg"
          alt="HEX Dashboard"
          className="h-8 w-8"
        />
      ),
    },
    {
      label: "Learn AI",
      href: "/learn-ai",
      icon: <IconBook className="h-8 w-8" />,
    },
    {
      label: "Casino",
      href: "https://win.morbius.io",
      icon: <IconCurrencyDollar className="h-8 w-8" />,
      external: true,
    },
    {
      label: "PulseChain Stats",
      href: "/pulsechain-stats",
      icon: <IconChartBar className="h-8 w-8" />,
    },
    {
      label: "Happy Pulse",
      href: "https://happypulse.vercel.app/",
      icon: <IconHeart className="h-8 w-8" />,
      external: true,
    },
    {
      label: "MassMailer",
      href: "https://www.pulsechaintester.xyz/",
      icon: <IconMail className="h-8 w-8" />,
      external: true,
    },
    {
      label: "API Endpoints",
      href: "/admin-stats",
      icon: <IconPhoneOutgoing className="h-8 w-8" />,
    },
    {
      label: "Hextroids",
      href: "https://pulsegame.vercel.app",
      icon: <IconHextroids className="h-8 w-8" />,
      external: true,
    },
    {
      label: "Stacker",
      href: "/stacker-game",
      icon: <IconDeviceGamepad2 className="h-8 w-8" />,
    },
  ];

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="bg-gradient-to-br from-[#2C3E50] via-[#34495E] to-[#3B6978] border-orange-500/40">
        <DrawerHeader className="border-b border-white/10">
          <DrawerTitle className="text-white text-xl font-semibold">
            More Options
          </DrawerTitle>
          <DrawerClose className="absolute right-4 top-4">
            <IconX className="h-5 w-5 text-white/70" />
          </DrawerClose>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-3 gap-4">
            {moreNavItems.map((item) => {
              const content = (
                <div className="flex flex-col items-center justify-center gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
                  <div className="text-orange-500">{item.icon}</div>
                  <span className="text-xs text-white text-center font-medium">
                    {item.label}
                  </span>
                </div>
              );

              if (item.external) {
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <Link key={item.label} href={item.href} onClick={onClose}>
                  {content}
                </Link>
              );
            })}
          </div>

          {/* Sponsored by Section */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3 text-center">
              Sponsored by
            </p>
            <a
              href="https://superstake.win"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-white hover:text-orange-500 transition-colors"
              onClick={onClose}
            >
              SuperStake.Win
            </a>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
