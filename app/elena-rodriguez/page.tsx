import AIAgentChat from '@/components/AIAgentChat';

const ElenaRodriguezPage: React.FC = () => {
  const quickQuestions = [
    "What are the best yield farming strategies?",
    "How do I assess DeFi protocol risks?",
    "What's the future of DeFi protocols?", 
    "How do I optimize my DeFi portfolio?",
    "What are the latest DeFi trends?"
  ];

  return (
    <AIAgentChat
      agentEndpoint="elena-rodriguez"
      title="Elena Rodriguez - DeFi Analyst"
      description="Expert in DeFi protocols, yield farming, and risk assessment"
      quickQuestions={quickQuestions}
    />
  );
};

export default ElenaRodriguezPage;