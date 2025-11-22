import { ContainerTextFlip } from "@/components/ui/container-text-flip";

export default function ContainerTextFlipDemo() {
  return (
    <ContainerTextFlip
      words={["AI Contract Agent", "Every Stat", "Every Token", "Every Holder", "Every Liquidity Pool", "Every Function", "Every Line Of Code", "Everything YOU Need To Know", "Making Blockchain Easy", "Only On PulseChain", "Morbius.io"]}
      wordColors={[
        "rgba(255, 107, 107, 0.3)", // AI Contract Agent - Coral Red
        "rgba(78, 205, 196, 0.3)", // Every Stat - Turquoise
        "rgba(69, 183, 209, 0.3)", // Every Token - Sky Blue
        "rgba(150, 206, 180, 0.3)", // Every Holder - Mint Green
        "rgba(254, 202, 87, 0.3)", // Every Liquidity Pool - Golden Yellow
        "rgba(255, 159, 243, 0.3)", // Every Function - Pink
        "rgba(84, 160, 255, 0.3)", // Every Line Of Code - Blue
        "rgba(95, 39, 205, 0.3)", // Everything YOU Need To Know - blue
        "rgba(0, 210, 211, 0.3)", // Making Blockchain Easy - Cyan
        "rgba(255, 159, 67, 0.3)", // Only On PulseChain - Orange
        "rgba(255, 99, 72, 0.3)"  // PulseChainAI.com - Tomato Red
      ]}
    />
  );
} 