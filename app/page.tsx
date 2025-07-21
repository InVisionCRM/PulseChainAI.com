import HeroSection from "@/components/HeroSection";
import AIAgentsSection from "@/components/AIAgentsSection";
import TeachersSection from "@/components/TeachersSection";
import LoaderThreeSection from "@/components/LoaderThreeSection";
import Link from "next/link";

export default function Home() {
  return (
    <main className="pt-16">
      <HeroSection />
      <AIAgentsSection />
      <LoaderThreeSection />
      <TeachersSection />
      
      {/* ElevenLabs Convai AI Help Agent */}
      <elevenlabs-convai agent-id="C25KqdgQbXZXGwa1OJcC"></elevenlabs-convai>
      <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>
    </main>
  );
}
