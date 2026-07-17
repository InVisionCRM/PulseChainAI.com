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
  IconCode,
  IconChartBar,
  IconSearch,
  IconRocket,
  IconHexagon,
  IconPhoneOutgoing,
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

  const primaryLinks: NavLink[] = [
    {
      label: "Home",
      href: "/",
      icon: (
        <IconHome className="h-5 w-5 shrink-0 text-[var(--text)]" />
      ),
    },
    {
      label: "Tokens",
      href: "/geicko",
      icon: (
        <IconCode className="h-5 w-5 shrink-0 text-[var(--text)]" />
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
      label: "RH Launchpads",
      href: "/robinhood/launchpads",
      icon: (
        <IconRocket className="h-5 w-5 shrink-0 text-[var(--text)]" />
      ),
    },
    {
      label: "PLS Launchpads",
      href: "/pulsechain/launchpads",
      icon: (
        <IconRocket className="h-5 w-5 shrink-0 text-[var(--text)]" />
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
    {
      label: "GOLD Badges Admin",
      href: "/admin/gold-badges",
      icon: (
        <IconPhoneOutgoing className="h-5 w-5 shrink-0 text-[var(--text)]" />
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
          <MobileSearchBar />
          <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">
            <SidebarBody>
                <div className="flex flex-1 flex-col overflow-x-hidden min-h-0">
                  <div className="mt-4 flex w-full flex-col gap-1 text-sm">
                    {/* Get Morbius Button */}
                    <a
                      href="https://pump.tires/token/0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2 px-3 mb-2 bg-orange-500/15 border border-orange-500/40 hover:bg-orange-500/25 rounded-lg transition duration-200"
                      title="Get Morbius"
                    >
                      <IconRocket className="h-5 w-5 shrink-0 text-orange-400" />
                      <span className="text-[var(--text)] text-sm whitespace-pre inline-block">
                        Get Morbius
                      </span>
                    </a>

                    {/* Install as a PWA (hidden when already installed) */}
                    <InstallButton />

                    {primaryLinks.map((link, idx) => (
                      <SidebarLink key={idx} link={link} />
                    ))}

                    <SidebarGroup
                      label="Community Builders"
                      icon={<span className="h-5 w-5 shrink-0" />}
                      initiallyOpen
                      links={[
                        {
                          label: "PLStart.me",
                          href: "https://plstart.me",
                          icon: <IconRocket className="h-5 w-5 shrink-0 text-[var(--text)]" />,
                        },
                        {
                          label: "Liquid Liberty",
                          href: "https://liquidliberty.io/",
                          icon: (
                            <img
                              src="https://cdn.dexscreener.com/cms/images/ad1c2e9c26c49bcaafa3dbad58c07b82893f2366dc64a47e75b40902ffddc098?width=64&height=64&quality=95&format=auto"
                              alt="Liquid Liberty (LBRTY)"
                              className="h-5 w-5 shrink-0 rounded-full object-cover"
                            />
                          ),
                        },
                      ]}
                    />

                    {/* Sponsored by Section */}
                    <div className="mt-6">
                      <div className="text-[var(--text-faint)] text-xs font-semibold uppercase tracking-wider px-2 mb-2 text-center">
                        Sponsored by
                      </div>
                      <div className="flex justify-center">
                        <SidebarLink
                          link={{
                            label: "SuperStake.Win",
                            href: "https://superstake.win",
                            icon: (<span className="h-5 w-5 shrink-0" />),
                          }}
                        />
                      </div>
                    </div>

                    {/* Theme toggle — pull-chain dark/light switch */}
                    <div className="mt-6 pt-3 border-t border-[var(--line)]">
                      <ThemeToggle variant="rail" />
                    </div>
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
