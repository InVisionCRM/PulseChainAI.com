"use client";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"
import { TopTickerBar } from "@/components/TopTickerBar";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import RichardHeartChatCard from "@/components/RichardHeartChatCard";
import {
  IconHome,
  IconCode,
  IconChartBar,
  IconSearch,
  IconRocket,
  IconHeart,
  IconHexagon,
  IconMail,
  IconDeviceGamepad2,
  IconPhoneOutgoing,
  IconChevronDown,
  IconX,
  IconCurrencyDollar,
  IconBook,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/ui/toast-provider";

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
        className="flex w-full items-center justify-between gap-2 px-2 py-2 transition duration-200 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
      >
        <span className="flex items-center gap-2">
          {icon}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-neutral-200 text-lg transition duration-150 whitespace-pre inline-block !p-0 !m-0 md:opacity-0 md:w-0 md:overflow-hidden md:translate-x-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto group-hover/sidebar:overflow-visible group-hover/sidebar:translate-x-1 md:ml-0"
          >
            {label}
          </motion.span>
        </span>
        <IconChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-white transition-transform duration-200 md:opacity-0 group-hover/sidebar:md:opacity-100",
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
  const [open, setOpen] = useState(false);

  const primaryLinks: NavLink[] = [
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
      label: "Hex Dashboard",
      href: "/hex-dashboard",
      icon: (
        <img
          src="/HEXagon (1).svg"
          alt="HEX Dashboard"
          className="h-5 w-5 shrink-0"
        />
      ),
    },
    {
      label: "Learn AI",
      href: "/learn-ai",
      icon: (
        <IconBook className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: "Casino",
      href: "https://win.morbius.io",
      icon: (
        <IconCurrencyDollar className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: "PulseChain Stats",
      href: "/pulsechain-stats",
      icon: (
        <IconChartBar className="h-5 w-5 shrink-0 text-white text-center items-center justify-center" />
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
        className={`${inter.variable} ${jetbrainsMono.variable} text-md md:text-base antialiased min-h-screen bg-[#0C2340]`}
      >
        <div className="flex flex-col min-h-screen md:h-screen w-full md:overflow-hidden">
          {!isStackerGamePage && <TopTickerBar />}
          <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">
            <Sidebar open={open} setOpen={setOpen}>
              <SidebarBody className="gap-10">
                <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto min-h-0">
                  <div className="mt-8 flex flex-col gap-2 items-center max-w-[200px] mx-auto text-sm">
                    {/* Get Morbius Button - visible when sidebar is expanded */}
                    <a
                      href="https://pump.tires/token/0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 group/sidebar py-2 px-2 bg-purple-700/40 backdrop-blur hover:bg-purple-700/50 rounded-md transition duration-200 md:opacity-0 md:w-0 md:overflow-hidden group-hover/sidebar:md:opacity-100 group-hover/sidebar:md:w-auto group-hover/sidebar:md:overflow-visible"
                      title="Get Morbius"
                    >
                      <IconRocket className="h-5 w-5 shrink-0 text-white" />
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-white text-sm transition duration-150 whitespace-pre inline-block !p-0 !m-0 md:opacity-0 md:w-0 md:overflow-hidden md:translate-x-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto group-hover/sidebar:overflow-visible group-hover/sidebar:translate-x-1 md:ml-0"
                      >
                        Get Morbius
                      </motion.span>
                    </a>

                    {primaryLinks.map((link, idx) => (
                      <SidebarLink key={idx} link={link} />
                    ))}

                    {/* Sponsored by Section */}
                    <div className="mt-6">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-neutral-400 text-xs font-semibold uppercase tracking-wider px-2 mb-2 text-center md:hidden group-hover/sidebar:md:block"
                      >
                        Sponsored by
                      </motion.div>
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
                  </div>
                </div>
              </SidebarBody>
            </Sidebar>
            <main className="flex-1 w-full overflow-y-auto">
              <ToastProvider>
                {children}
              </ToastProvider>
            </main>
          </div>
        </div>
        <RichardHeartChatCard />
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
