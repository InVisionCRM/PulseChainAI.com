import HeroSection from "@/components/HeroSection";
import AIAgentsSection from "@/components/AIAgentsSection";
import ProjectsSection from "@/components/ProjectsSection";
import Link from "next/link";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <AIAgentsSection />
      <ProjectsSection />
    </main>
  );
}
