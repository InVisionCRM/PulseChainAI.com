"use client";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"
import { TopTickerBar } from "@/components/TopTickerBar";
import { MobileSearchBar } from "@/components/MobileSearchBar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  IconHome,
  IconChartBar,
  IconSearch,
  IconRocket,
  IconHexagon,
  IconChevronDown,
  IconX,
  IconCurrencyDollar,
  IconBook,
  IconWallet,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, Suspense } from "react";
import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/ui/toast-provider";
import { AddToGroupModal } from "@/components/portfolio/AddToGroupModal";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PullChainOverlay } from "@/components/theme/PullChainOverlay";
import { IntroSplash } from "@/components/IntroSplash";
import { InstallButton } from "@/components/pwa/InstallButton";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: 'swap',
});

type NavLink = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const SidebarGroup = ({
  label,
  icon,
  links,
  initiallyOpen = false,
}: {
  label: string;
  icon: React.ReactNode;
  links: NavLink[];
  initiallyOpen?: boolean;
}) => {
  const [expanded, setExpanded] = useState(initiallyOpen);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 transition duration-200 hover:bg-[var(--surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
      >
        <span className="flex items-center gap-2">
          {icon}
          <span className="text-[var(--text-faint)] text-xs font-semibold uppercase tracking-wider whitespace-pre inline-block">
            {label}
          </span>
        </span>
        <IconChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform duration-200",
            expanded ? "rotate-180" : "rotate-0"
          )}
        />
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {links.map((link, idx) => (
            <SidebarLink
              key={`${label.toLowerCase()}-${idx}`}
              link={link}
              className="md:pl-6"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAICodeReaderPage = pathname === "/ai-agent";
  const isGeickoPage = pathname === "/geicko";
  const isStackerGamePage = pathname === "/stacker-game";
  // The home page has its own prominent search bar, so the sticky mobile
  // search would be a redundant second bar there — hide it on "/".
  const isHomePage = pathname === "/";

  const primaryLinks: NavLink[] = [
    {
      label: "Home",
      href: "/",
      icon: (
        <IconHome className="h-5 w-5 shrink-0 text-[var(--text)]" />
      ),
    },
    {
      label: "Portfolio",
      href: "/portfolio",
      icon: (
        <IconWallet className="h-5 w-5 shrink-0 text-[var(--text)]" />
      ),
    },
    {
      label: "SuperStake",
      href: "/superstake",
      icon: (
        <IconChartBar className="h-5 w-5 shrink-0 text-[var(--text)]" />
      ),
    },
    {
      label: "HEX Strategist",
      href: "/hex-strategist",
      icon: (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/hex-logo.svg" alt="HEX" className="h-5 w-5 shrink-0 object-contain" />
      ),
    },
    {
      label: "Learn AI",
      href: "/learn-ai",
      icon: (
        <IconBook className="h-5 w-5 shrink-0 text-[var(--text)]" />
      ),
    },
    {
      label: "Gaming",
      href: "https://win.morbius.io",
      icon: (
        <IconCurrencyDollar className="h-5 w-5 shrink-0 text-[var(--text)]" />
      ),
    },
  ];


  const handleOpenSearch = () => {
    const event = new Event('openAICodeSearch');
    window.dispatchEvent(event);
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set the theme class before first paint so there's no flash.
            Defaults to dark (the app's native look) until the user toggles. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pc-theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.classList.toggle('dark',t==='dark');}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
        {/* PWA: installable app metadata */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0b0613" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Morbius" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} text-md md:text-base antialiased min-h-screen bg-[var(--app-bg)]`}
      >
        <div className="flex flex-col min-h-screen md:h-screen w-full md:overflow-hidden">
          {!isStackerGamePage && <TopTickerBar />}
          {!isHomePage && <MobileSearchBar />}
          <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">
            <SidebarBody>
                <div className="flex flex-1 flex-col overflow-x-hidden min-h-0">
                  <div className="mt-3 flex w-full flex-col gap-1 text-sm">
                    {/* Utility row — Get Morbius / Install / Theme as three
                        equal compact tiles. Flex-1 rather than grid-cols-3 so
                        the row stays even when Install hides itself (already
                        installed, or a browser with no install prompt). */}
                    <div className="mb-2 flex items-stretch gap-1">
                      <a
                        href="https://pump.tires/token/0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1 py-2 text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
                        title="Get Morbius"
                      >
                        <IconRocket className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                        <span className="text-[10px] font-semibold leading-none">Morbius</span>
                      </a>

                      {/* Hidden when already installed / unsupported browser. */}
                      <InstallButton variant="tile" />

                      <ThemeToggle variant="tile" />
                    </div>

                    {primaryLinks.map((link, idx) => (
                      <SidebarLink key={idx} link={link} />
                    ))}

                    {/* Community Builders, Sponsored, and GOLD Badges Admin
                        moved to the global footer to keep the nav lean.
                        The theme toggle now lives in the utility row above. */}
                  </div>
                </div>
              </SidebarBody>
            <main className="flex-1 w-full overflow-y-auto pb-20 md:pb-0">
              <ToastProvider>
                {children}
              </ToastProvider>
            </main>
          </div>
          <Suspense fallback={null}>
            <MobileBottomNav />
          </Suspense>
        </div>
        <AddToGroupModal />
        <PullChainOverlay />
        <IntroSplash />
        <Analytics />
      </body>
    </html>
  );
}

const Logo = () => {
  return (
    <Link
      href="/"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-slate-950"
    >
      <IconHexagon className="h-6 w-6 shrink-0 text-orange-500" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium whitespace-pre text-slate-950 dark:text-[var(--text)]"
      >
        Morbius.io
      </motion.span>
    </Link>
  );
};

const LogoIcon = () => {
  return (
    <Link
      href="/"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-slate-950"
    >
      <IconHexagon className="h-6 w-6 shrink-0 text-orange-500" />
    </Link>
  );
};
