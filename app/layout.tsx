"use client";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"
import { TopTickerBar } from "@/components/TopTickerBar";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  IconHome,
  IconCode,
  IconChartBar,
  IconChartPie,
  IconSettings,
  IconSearch,
  IconRocket,
  IconHeart,
  IconHexagon,
  IconMail,
  IconDeviceGamepad2,
  IconPhoneOutgoing,
  IconWallet,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAICodeReaderPage = pathname === "/ai-agent";
  const isGeickoPage = pathname === "/geicko";
  const isStackerGamePage = pathname === "/stacker-game";
  const isAdminStatsCleanPage = pathname === "/admin-stats-clean";
  const [open, setOpen] = useState(false);

  const links = [
    {
      label: "Home",
      href: "/",
      icon: (
        <IconHome className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: "Tokens",
      href: "/geicko",
      icon: (
        <IconCode className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: "Portfolio",
      href: "/portfolio",
      icon: (
        <IconWallet className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: "Blockchain Analyzer",
      href: "/blockchain-analyzer",
      icon: (
        <IconChartBar className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: "Stat Counter Builder",
      href: "/stat-counter-builder",
      icon: (
        <IconChartPie className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: "Happy Pulse",
      href: "https://happypulse.vercel.app/",
      icon: (
        <IconHeart className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: "MassMailer",
      href: "https://www.pulsechaintester.xyz/",
      icon: (
        <IconMail className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: "API Endpoints",
      href: "/admin-stats",
      icon: (
        <IconPhoneOutgoing className="h-5 w-5 shrink-0 text-white" />
      ),
    },
  ];

  const gamesLinks = [
    {
      label: "Hextroids",
      href: "https://pulsegame.vercel.app",
      icon: (
        <IconRocket className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: "Stacker",
      href: "/stacker-game",
      icon: (
        <IconDeviceGamepad2 className="h-5 w-5 shrink-0 text-white" />
      ),
    },
  ];

  const handleOpenSearch = () => {
    const event = new Event('openAICodeSearch');
    window.dispatchEvent(event);
  };

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} text-md md:text-base antialiased min-h-screen`}
        style={{ backgroundColor: '#0C2340' }}
      >
        <div className="flex flex-col min-h-screen md:h-screen w-full md:overflow-hidden">
          {!isStackerGamePage && !isAdminStatsCleanPage && <TopTickerBar />}
          <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">
            {!isAdminStatsCleanPage && (
              <Sidebar open={open} setOpen={setOpen}>
                <SidebarBody className="justify-between gap-10">
                  <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
                    <div className="mt-8 flex flex-col gap-2">
                      {links.map((link, idx) => (
                        <SidebarLink key={idx} link={link} />
                      ))}

                      {/* Search button - visible on Token + AI and Tokens pages */}
                      {(isAICodeReaderPage || isGeickoPage) && (
                        <button
                          type="button"
                          onClick={handleOpenSearch}
                          className="flex items-center justify-center gap-2 group/sidebar py-2 px-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition duration-200"
                          title="Search Token or Contract"
                        >
                          <IconSearch className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
                          {open && (
                            <span className="text-sm text-neutral-700 dark:text-neutral-200 group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0">
                              Search
                            </span>
                          )}
                        </button>
                      )}

                      {/* Games Section */}
                      <div className="mt-6">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-neutral-400 text-xs font-semibold uppercase tracking-wider px-2 mb-2 md:hidden group-hover/sidebar:md:block"
                        >
                          Games
                        </motion.div>
                        {gamesLinks.map((link, idx) => (
                          <SidebarLink key={`game-${idx}`} link={link} />
                        ))}
                      </div>

                    {/* Sponsored by Section */}
                    <div className="mt-6">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-neutral-400 text-xs font-semibold uppercase tracking-wider px-2 mb-2 md:hidden group-hover/sidebar:md:block"
                      >
                        Sponsored by
                      </motion.div>
                      <SidebarLink
                        link={{
                          label: "SuperStake.Win",
                          href: "https://superstake.win",
                          icon: (<span className="h-5 w-5 shrink-0" />),
                        }}
                      />
                    </div>
                    </div>
                  </div>
                </SidebarBody>
              </Sidebar>
            )}
            <main className="flex-1 w-full overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
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
        className="font-medium whitespace-pre text-slate-950 dark:text-white"
      >
        PulseChain AI
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
