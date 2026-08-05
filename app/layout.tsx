"use client";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"
import { TopTickerBar } from "@/components/TopTickerBar";
import { MobileSearchBar } from "@/components/MobileSearchBar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  IconSearch,
  IconHexagon,
  IconChevronDown,
  IconX,
  IconCurrencyDollar,
  IconBook,
} from "@tabler/icons-react";
import { ArtIcon } from "@/components/ui/ArtIcon";
import { DesktopSearchBar } from "@/components/DesktopSearchBar";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, Suspense } from "react";
import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/ui/toast-provider";
import { AddToGroupModal } from "@/components/portfolio/AddToGroupModal";
import { PullChainOverlay } from "@/components/theme/PullChainOverlay";
import { IntroSplash } from "@/components/IntroSplash";
import DevlogModal from "@/components/devlog/DevlogModal";
import DevlogNavButton from "@/components/devlog/DevlogNavButton";

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
  // The HEX and SuperStake pages are about one asset each, not a pair the
  // visitor is looking for, so a pair search at the top of them is just a bar
  // in the way of the content. It stays reachable from the bottom-nav Search.
  const isSingleAssetPage =
    pathname === "/hex-dashboard" ||
    pathname === "/hex-strategist" ||
    pathname === "/superstake" ||
    pathname.startsWith("/superstake/");

  const primaryLinks: NavLink[] = [
    {
      label: "Home",
      href: "/",
      icon: <ArtIcon src="/home-icon.png" alt="Home" />,
    },
    {
      label: "Portfolio",
      href: "/portfolio",
      icon: <ArtIcon src="/wallet-icon.png" alt="Portfolio" />,
    },
    {
      label: "SuperStake",
      href: "/superstake",
      icon: <ArtIcon src="/superstake-logo.png" alt="SuperStake" />,
    },
    {
      label: "HEX Strategist",
      href: "/hex-strategist",
      icon: <ArtIcon src="/hex-logo.svg" alt="HEX" />,
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
          {!isHomePage && !isSingleAssetPage && <MobileSearchBar />}
          <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">
            <SidebarBody>
                <div className="flex flex-1 flex-col overflow-x-hidden min-h-0">
                  {/* Search sits above the links because it is the most-used
                      control in the column. Click-only on purpose: the pages
                      that want "/" and Ctrl+K already bind them (the screener
                      on home, the bar on geicko), and a second listener here
                      opened two modals on one keypress. */}
                  <div className="mt-3 px-1">
                    <DesktopSearchBar neon bindShortcuts={false} />
                  </div>
                  <div className="mt-2 flex w-full flex-col gap-1 text-sm">
                    {/* Nav links only. Get Morbius / Install / Theme moved to
                        the column's footer, above the chat button, so the
                        scrolling region is links and nothing else. Community
                        Builders, Sponsored and GOLD Badges Admin live in the
                        global footer for the same reason. */}
                    {primaryLinks.map((link, idx) => (
                      <SidebarLink key={idx} link={link} />
                    ))}
                    {/* Opens the devlog rather than navigating, so it sits with
                        the links but isn't one. */}
                    <DevlogNavButton />
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
        <DevlogModal />
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
