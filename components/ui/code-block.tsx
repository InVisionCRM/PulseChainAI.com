"use client";
import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Check, Copy, Search, X } from "lucide-react";
import { GeickoToast } from "@/components/geicko";

type CodeBlockProps = {
  language: string;
  filename: string;
  highlightLines?: number[];
} & (
  | {
      code: string;
      tabs?: never;
    }
  | {
      code?: never;
      tabs: Array<{
        name: string;
        code: string;
        language?: string;
        highlightLines?: number[];
      }>;
    }
);

export const CodeBlock = ({
  language,
  filename,
  code,
  highlightLines = [],
  tabs = [],
}: CodeBlockProps) => {
  const [activeTab, setActiveTab] = React.useState(0);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  const tabsExist = tabs.length > 0;

  const [showToast, setShowToast] = useState(false);

  const copyToClipboard = async () => {
    const textToCopy = tabsExist ? tabs[activeTab].code : code;
    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    if (!isSearchOpen) {
      setSearchQuery("");
    }
  };

  const activeCode = tabsExist ? tabs[activeTab].code : code;
  const activeLanguage = tabsExist
    ? tabs[activeTab].language || language
    : language;
  const activeHighlightLines = tabsExist
    ? tabs[activeTab].highlightLines || []
    : highlightLines;

  // Find lines that contain the search query
  const getSearchHighlightLines = (code: string, query: string) => {
    if (!query.trim()) return [];
    const lines = code.split('\n');
    const highlightedLines: number[] = [];
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        highlightedLines.push(index + 1); // Line numbers are 1-based
      }
    });
    return highlightedLines;
  };

  const searchHighlightLines = searchQuery
    ? getSearchHighlightLines(activeCode, searchQuery)
    : [];

  const allHighlightLines = [...activeHighlightLines, ...searchHighlightLines];

  return (
    <div className="relative w-full rounded-lg bg-slate-900 p-4 font-mono text-sm">
      <div className="flex flex-col gap-2">
        {tabsExist && (
          <div className="flex  overflow-x-auto">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`px-3 !py-2 text-xs transition-colors font-sans ${
                  activeTab === index
                    ? "text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        )}
        {!tabsExist && filename && (
          <div className="flex justify-between items-center py-2">
            <div className="text-xs text-zinc-400">{filename}</div>
            <div className="flex items-center gap-2">
              {isSearchOpen && (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search code..."
                    className="w-32 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
              <button
                onClick={toggleSearch}
                className={`flex items-center gap-1 text-xs transition-colors font-sans ${
                  isSearchOpen ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title={isSearchOpen ? "Close search" : "Search code"}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-sans"
                title="Copy code"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
      <SyntaxHighlighter
        language={activeLanguage}
        style={atomDark}
        customStyle={{
          margin: 0,
          padding: 0,
          background: "transparent",
          fontSize: "0.875rem", // text-sm equivalent
        }}
        wrapLines={true}
        showLineNumbers={true}
        lineProps={(lineNumber) => ({
          style: {
            backgroundColor: allHighlightLines.includes(lineNumber)
              ? searchHighlightLines.includes(lineNumber)
                ? "rgba(255,165,0,0.2)" // Orange highlight for search matches
                : "rgba(255,255,255,0.1)" // White highlight for other highlights
              : "transparent",
            display: "block",
            width: "100%",
          },
        })}
        PreTag="div"
      >
        {String(activeCode)}
      </SyntaxHighlighter>

      {/* Copy confirmation toast */}
      {showToast && (
        <GeickoToast
          message="Code copied!"
          variant="success"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};
