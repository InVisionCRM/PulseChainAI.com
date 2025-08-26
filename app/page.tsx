import { Highlight } from "@/components/ui/hero-highlight";
import AIAgentsSection from "@/components/AIAgentsSection";
import TeachersSection from "@/components/TeachersSection";
import LoaderThreeSection from "@/components/LoaderThreeSection";
import { Boxes } from "@/components/ui/background-boxes";
import { GridPattern } from "@/components/magicui/grid-pattern";
import { FlipText } from "@/components/magicui/flip-text";
import Link from "next/link";

export default function Home() {
  return (
    <main className="pt-16">
      <div className="h-screen relative w-full overflow-hidden bg-black flex flex-col items-center justify-center">
        <div className="absolute inset-0 w-full h-full bg-black z-20 [mask-image:radial-gradient(transparent,white)] pointer-events-none" />
        
        {/* Show GridPattern on medium and mobile, Boxes on large screens */}
        <div className="hidden md:block">
          <Boxes />
        </div>
        <div className="block md:hidden">
          <GridPattern />
        </div>
        
        <div className="relative z-30 text-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
            <div className="relative mb-4">
              <FlipText className="text-white text-5xl md:text-7xl lg:text-8xl font-bold">
                PULSECHAIN
              </FlipText>
            </div>
            <Highlight className="text-white">
              AI
            </Highlight>
          </h1>
          <p className="text-sm text-gray-400">
            Made by <Link href="https://superstake.win" target="_blank" className="text-blue-400 hover:text-blue-300 transition-colors">SuperStake.Win</Link>
          </p>
        </div>
      </div>
      <AIAgentsSection />
      <LoaderThreeSection />
      <TeachersSection />
      
      {/* ElevenLabs Convai AI Help Agent */}
      {/* <elevenlabs-convai agent-id="C25KqdgQbXZXGwa1OJcC"></elevenlabs-convai>
      <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="javascript"></script> */}
    </main>
  );
}
