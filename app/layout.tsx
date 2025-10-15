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
  IconHexagon,
  IconChartPie,
  IconSettings,
  IconSearch,
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
      label: "AI Code Reader",
      href: "/ai-agent",
      icon: (
        <IconCode className="h-5 w-5 shrink-0 text-white" />
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
      label: "HEX Dashboard",
      href: "/hex-dashboard",
      icon: (
        <IconHexagon className="h-5 w-5 shrink-0 text-white" />
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
      label: "Admin Stats",
      href: "/admin-stats",
      icon: (
        <IconSettings className="h-5 w-5 shrink-0 text-white" />
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
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen`}
        style={{ backgroundColor: '#0C2340' }}
      >
        <div className="flex flex-col h-screen w-full overflow-hidden">
          <TopTickerBar />
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            <Sidebar open={open} setOpen={setOpen}>
              <SidebarBody className="justify-between gap-10">
                <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
                  {open ? <Logo /> : <LogoIcon />}
                  <div className="mt-8 flex flex-col gap-2">
                    {links.map((link, idx) => (
                      <SidebarLink key={idx} link={link} />
                    ))}

                    {/* Search button - only visible on AI Code Reader page */}
                    {isAICodeReaderPage && (
                      <button
                        type="button"
                        onClick={handleOpenSearch}
                        className="flex items-center justify-start gap-2 group/sidebar py-2 px-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition duration-200"
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
                  </div>
                </div>
                <div>
                  <SidebarLink
                    link={{
                      label: "SuperStake.Win",
                      href: "https://superstake.win",
                      icon: (
                        <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
                          SS
                        </div>
                      ),
                    }}
                  />
                </div>
              </SidebarBody>
            </Sidebar>
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
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <IconHexagon className="h-6 w-6 shrink-0 text-orange-500" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium whitespace-pre text-black dark:text-white"
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
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <IconHexagon className="h-6 w-6 shrink-0 text-orange-500" />
    </Link>
  );
};
