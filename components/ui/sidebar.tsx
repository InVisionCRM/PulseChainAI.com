"use client";
import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconMenu2, IconX, IconSearch, IconHexagon } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { search } from "@/services/pulsechainService";
import type { SearchResultItem } from "@/types";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(true); // Start open on desktop

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate: animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

type MotionDivProps = React.ComponentProps<typeof motion.div>;

export const SidebarBody = (props: MotionDivProps & { children?: React.ReactNode }) => {
  const { children, ...rest } = props;
  return (
    <>
      <DesktopSidebar {...rest}>{children}</DesktopSidebar>
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof motion.div>, "children"> & { children?: React.ReactNode }) => {
  const { animate } = useSidebar();
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <>
      <motion.div
        className={cn(
          "h-full px-4 py-4 hidden md:flex md:flex-col bg-gradient-to-br from-[#2C3E50] via-[#34495E] to-[#3B6978] border-r border-orange-500/40 w-[300px] shrink-0 relative z-50 group/sidebar",
          className
        )}
        animate={{
          width: animate ? (isHovered ? "300px" : "80px") : "300px",
        }}
        transition={{
          duration: 0.2,
          ease: "easeInOut",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        <div className="flex flex-col justify-between h-full">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            {isHovered ? <Logo /> : <LogoIcon />}
            {children as React.ReactNode}
          </div>
        </div>
      </motion.div>
    </>
  );
};

const Logo = () => {
  return (
    <div className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal">
      <IconHexagon className="h-6 w-6 shrink-0 text-orange-500" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium whitespace-pre text-white"
      >
        PulseChain AI
      </motion.span>
    </div>
  );
};

const LogoIcon = () => {
  return (
    <div className="relative z-20 flex items-center justify-center py-1">
      <IconHexagon className="h-6 w-6 shrink-0 text-orange-500" />
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Debounced search effect
  useEffect(() => {
    if (searchValue.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setShowResults(false);
      return;
    }

    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(searchValue);
    if (isAddress) {
      setSearchResults([]);
      setIsSearching(false);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);
    const timer = setTimeout(async () => {
      try {
        const results = await search(searchValue);
        setSearchResults(results.slice(0, 10));
        setSearchError(null);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : 'Search failed');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowResults(false);
      }
    };

    if (showResults) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showResults]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/ai-agent?address=${searchValue.trim()}`);
      setSearchValue("");
      setShowResults(false);
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    router.push(`/ai-agent?address=${item.address}`);
    setSearchValue("");
    setShowResults(false);
    setSearchResults([]);
  };

  return (
    <>
      <div
        className={cn(
          "h-[50px] flex flex-row md:hidden items-center justify-between gap-2 w-full overflow-hidden sticky top-0 bg-white/5 backdrop-blur-xl border-b border-white/40 px-4 z-50"
        )}
        {...props}
      >
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1 search-container">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search token..."
              className="w-full h-8 px-3 pr-8 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
            <button
              type="submit"
              aria-label="Search"
              title="Search"
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <IconSearch className="h-4 w-4 text-white/70" />
            </button>
          </div>
        </form>
        
        {/* Hamburger Menu Button */}
        <IconMenu2
          className="text-neutral-200 h-6 w-6 cursor-pointer drop-shadow-lg flex-shrink-0"
          onClick={() => setOpen(!open)}
        />
      </div>
      
      {/* Search Results Dropdown - Fixed Position */}
      {showResults && (
        <div className="fixed left-4 right-4 top-[58px] bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl z-[9999] max-h-80 overflow-y-auto search-container">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-lg opacity-20 pointer-events-none"
            style={{ backgroundImage: 'url(/Mirage.jpg)' }}
          />
          <div className="relative z-10">
            {isSearching && (
              <div className="flex items-center justify-center p-4">
                <div className="text-slate-400 text-sm">Searching...</div>
              </div>
            )}
            {!isSearching && searchError && (
              <div className="p-4 text-red-400 text-sm">{searchError}</div>
            )}
            {!isSearching && searchValue.length >= 2 && searchResults.length === 0 && !searchError && (
              <div className="p-4 text-slate-400 text-sm">No tokens found for &quot;{searchValue}&quot;</div>
            )}
            {!isSearching && searchResults.map(item => (
              <div
                key={item.address}
                onClick={() => handleSelectResult(item)}
                className="flex items-center gap-3 p-3 hover:bg-slate-700/50 cursor-pointer transition-colors"
              >
                {item.icon_url ? (
                  <img src={item.icon_url} alt={`${item.name} logo`} className="w-8 h-8 rounded-full bg-slate-700" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-purple-400 font-bold text-sm flex-shrink-0">
                    {item.name?.[0] || '?'}
                  </div>
                )}
                <div className="overflow-hidden flex-1">
                  <div className="font-semibold text-white truncate">
                    {item.name} {item.symbol && `(${item.symbol})`}
                  </div>
                  <div className="text-xs text-slate-400 capitalize">{item.type}</div>
                  <div className="text-xs text-slate-500 font-mono truncate">{item.address}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
            }}
            className={cn(
              "fixed h-full w-full inset-0 bg-gradient-to-br from-[#2C3E50] via-[#34495E] to-[#3B6978] border-r border-orange-500/10 p-10 z-[100] flex flex-col justify-between",
              className
            )}
          >
            <div className="flex flex-col justify-between h-full">
              <div>
                <div
                  className="absolute right-10 top-10 z-50 text-neutral-800 dark:text-neutral-200 cursor-pointer"
                  onClick={() => setOpen(false)}
                >
                  <IconX className="h-8 w-8" />
                </div>
                <div className="mt-16">
                  {children}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
}) => {
  return (
    <a
      href={link.href}
      className={cn(
        "flex items-center group/sidebar py-2 justify-start gap-2 md:w-full md:justify-center md:gap-0 md:pl-0 group-hover/sidebar:md:justify-start group-hover/sidebar:md:gap-2",
        className
      )}
      {...props}
    >
      {link.icon}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-neutral-700 dark:text-neutral-200 text-lg transition duration-150 whitespace-pre inline-block !p-0 !m-0 md:opacity-0 md:w-0 md:overflow-hidden md:translate-x-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto group-hover/sidebar:overflow-visible group-hover/sidebar:translate-x-1 md:ml-0"
      >
        {link.label}
      </motion.span>
    </a>
  );
};
