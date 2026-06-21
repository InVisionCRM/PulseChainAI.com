"use client";
import React from "react";
import { FloatingNav } from "./ui/floating-navbar";
import {
  IconHome,
  IconCode,
  IconBrain,
  IconDots
} from '@tabler/icons-react';

export default function NavigationBar() {
  const navItems = [
    { name: "Home", link: "/", icon: <IconHome className="h-4 w-4 text-[var(--text-muted)] dark:text-[var(--text)]" /> },
    { name: "Ask AI", link: "/ai-agent", icon: <IconBrain className="h-4 w-4 text-[var(--text-muted)] dark:text-[var(--text)]" /> },
    { name: "Blockchain Analyzer", link: "/blockchain-analyzer", icon: <IconCode className="h-4 w-4 text-[var(--text-muted)] dark:text-[var(--text)]" /> },
    { name: "More", link: "/#more", icon: <IconDots className="h-4 w-4 text-[var(--text-muted)] dark:text-[var(--text)]" /> },
  ];

  return (
    <div className="relative w-full">
      <FloatingNav navItems={navItems} />
    </div>
  );
} 