"use client";
import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
  colors?: string[];
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  colors,
  ...props
}: AuroraBackgroundProps) => {
  // Default colors if none provided
  const defaultColors = [
    "#EC13AC", "#364AFF", "#EF1091", "#3F41FF", "#D917E9", 
    "#215FFF", "#FE010C", "#0087FF", "#740CFF", "#EF1196"
  ];
  
  const auroraColors = colors || defaultColors;
  
  // Create the aurora gradient string
  const auroraGradient = auroraColors.map((color, index) => 
    `${color} ${(index + 1) * 5}%`
  ).join(',');

  return (
    <main>
      <div
        className={cn(
          "transition-bg relative flex h-[100vh] flex-col items-center justify-center bg-zinc-50 text-slate-950 dark:bg-zinc-900",
          className,
        )}
        {...props}
      >
        <div
          className="absolute inset-0 overflow-hidden"
          style={
            {
              "--aurora": `repeating-linear-gradient(100deg,${auroraGradient})`,
              "--dark-gradient":
                "repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%)",
              "--white-gradient":
                "repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)",

              "--color-1": auroraColors[0] || "#EC13AC",
              "--color-2": auroraColors[1] || "#364AFF",
              "--color-3": auroraColors[2] || "#EF1091",
              "--color-4": auroraColors[3] || "#3F41FF",
              "--color-5": auroraColors[4] || "#D917E9",
              "--color-6": auroraColors[5] || "#215FFF",
              "--color-7": auroraColors[6] || "#FE010C",
              "--color-8": auroraColors[7] || "#0087FF",
              "--color-9": auroraColors[8] || "#740CFF",
              "--color-10": auroraColors[9] || "#EF1196",
              "--black": "#000",
              "--white": "#fff",
              "--transparent": "transparent",
            } as React.CSSProperties
          }
        >
          <div
            //   I'm sorry but this is what peak developer performance looks like // trigger warning
            className={cn(
              `after:animate-aurora pointer-events-none absolute -inset-[10px] [background-image:var(--white-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%] opacity-50 blur-[30px] invert filter will-change-transform [--aurora:repeating-linear-gradient(100deg,var(--color-1)_5%,var(--color-2)_10%,var(--color-3)_15%,var(--color-4)_20%,var(--color-5)_25%,var(--color-6)_30%,var(--color-7)_35%,var(--color-8)_40%,var(--color-9)_45%,var(--color-10)_50%)] [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)] [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)] after:[background-size:200%,_100%] after:[background-attachment:fixed] after:mix-blend-difference after:content-[""] dark:[background-image:var(--dark-gradient),var(--aurora)] dark:invert-0 after:dark:[background-image:var(--dark-gradient),var(--aurora)]`,

              showRadialGradient &&
                `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]`,
            )}
          ></div>
        </div>
        {children}
      </div>
    </main>
  );
};
