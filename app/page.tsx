import { Highlight } from "@/components/ui/hero-highlight";
import AIAgentsSection from "@/components/AIAgentsSection";
import TeachersSection from "@/components/TeachersSection";
import LoaderThreeSection from "@/components/LoaderThreeSection";
import { Boxes } from "@/components/ui/background-boxes";
import { VideoText } from "@/components/magicui/video-text";
import Link from "next/link";

export default function Home() {
  return (
    <main className="pt-16">
      <div className="h-screen relative w-full overflow-hidden bg-black flex flex-col items-center justify-center">
        <div className="absolute inset-0 w-full h-full bg-black z-20 [mask-image:radial-gradient(transparent,white)] pointer-events-none" />
        
        <Boxes />
        <div className="relative z-30 text-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
            <div className="relative h-[200px] w-full overflow-hidden inline-block mb-4">
              <VideoText src="https://dvba8d38nfde7nic.public.blob.vercel-storage.com/Video/videotext">PULSECHAIN</VideoText>
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
