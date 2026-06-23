"use client";
import Link from "next/link";
import {
  IconBook,
  IconCurrencyDollar,
  IconChartBar,
  IconPhoneOutgoing,
  IconWallet,
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
      label: "Portfolio",
      href: "/portfolio",
      icon: <IconWallet className="h-8 w-8" />,
    },
    {
      label: "HEX Strategist",
      href: "/hex-strategist",
      // eslint-disable-next-line @next/next/no-img-element
      icon: <img src="/hex-logo.svg" alt="HEX" className="h-8 w-8 object-contain" />,
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
      label: "GOLD Badges Admin",
      href: "/admin/gold-badges",
      icon: <IconPhoneOutgoing className="h-8 w-8" />,
    },
  ];

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="bg-gradient-to-b from-[var(--panel)] to-[var(--surface-2)] border-[var(--line)]">
        <DrawerHeader className="border-b border-[var(--line)]">
          <DrawerTitle className="text-[var(--text)] text-xl font-semibold">
            More Options
          </DrawerTitle>
          <DrawerClose className="absolute right-4 top-4">
            <IconX className="h-5 w-5 text-[var(--text-muted)]" />
          </DrawerClose>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-3 gap-4">
            {moreNavItems.map((item) => {
              const content = (
                <div className="flex flex-col items-center justify-center gap-3 p-4 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--line)] transition-colors">
                  <div className="text-orange-500">{item.icon}</div>
                  <span className="text-xs text-[var(--text)] text-center font-medium">
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
          <div className="mt-8 pt-6 border-t border-[var(--line)]">
            <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-3 text-center">
              Sponsored by
            </p>
            <a
              href="https://superstake.win"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[var(--text)] hover:text-orange-500 transition-colors"
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
