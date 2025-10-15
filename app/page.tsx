import { Highlight } from "@/components/ui/hero-highlight";
import AIAgentsSection from "@/components/AIAgentsSection";
import LoaderThreeSection from "@/components/LoaderThreeSection";
import ColourfulText from "@/components/ui/colourful-text";
import { TopTokensList } from "@/components/TopTokensList";
import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import Link from "next/link";

export default function Home() {
  const appPicsImages = [
    "/app-pics/ai-therapist.png",
    "/app-pics/clean.png",
    "/app-pics/eth-banner.png",
    "/app-pics/eth-logo.png",
    "/app-pics/hex-on-eth.jpg",
    "/app-pics/hex-pulse-staking.jpg",
    "/app-pics/IMG_0371.JPG",
    "/app-pics/pls-hex.png",
    "/app-pics/positive-vibes-only.png",
    "/app-pics/Screenshot 2025-08-05 at 10.23.58 AM.png",
    "/app-pics/talk-to-richard.png"
  ];

  return (
    <div className="w-full pt-12">
      <div
        className="min-h-screen relative w-full flex flex-col items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/Mirage.jpg)',
        }}
      >
        <div className="absolute inset-0 w-full h-full z-20 [mask-image:radial-gradient(transparent,white)] pointer-events-none" style={{ backgroundColor: '#0C2340' }} />

        <div className="absolute inset-0 z-10">
          <ThreeDMarquee images={appPicsImages} className="h-full" />
        </div>

        <div className="relative z-30 text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="relative inline-block px-6 py-3 rounded-lg" style={{ backgroundColor: '#0C2340' }}>
              <span className="text-5xl md:text-7xl lg:text-8xl font-bold" style={{ color: '#FA4616' }}>
                PULSECHAIN
              </span>
              <div className="absolute inset-0 bg-white opacity-10 rounded-lg"></div>
            </div>
            <div className="bg-white z-10 rounded inline-block -mt-[15px] overflow-hidden relative" style={{ boxShadow: "0 -4px 8px 2px rgba(0, 0, 0, 0.8)" }}>
              <div className="text-4xl md:text-6xl lg:text-7xl font-bold text-black">
                AI
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            Made by <Link href="https://superstake.win" target="_blank" className="text-blue-400 hover:text-blue-300 transition-colors">SuperStake.Win</Link>
          </p>
        </div>
      </div>
      <TopTokensList />
      <AIAgentsSection />
      <LoaderThreeSection />
      
      {/* ElevenLabs Convai AI Help Agent */}
      {/* <elevenlabs-convai agent-id="C25KqdgQbXZXGwa1OJcC"></elevenlabs-convai>
      <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="javascript"></script> */}
    </div>
  );
}
