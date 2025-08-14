import AIAgentChat from '@/components/AIAgentChat';

const HappyPulsePage: React.FC = () => {
  const quickQuestions = [
    "Turn my negative thoughts into positive ones",
    "Help me see the bright side of my situation",
    "Transform my crypto FOMO into optimism",
    "Make my bad day sound better",
    "Give me a positive perspective on life"
  ];

  return (
    <AIAgentChat
      agentEndpoint="happy-pulse"
      title="HappyPulse - Positivity Transformer"
      description="AI-powered positivity engine that transforms negative thoughts into uplifting messages"
      quickQuestions={quickQuestions}
    />
  );
};

export default HappyPulsePage;