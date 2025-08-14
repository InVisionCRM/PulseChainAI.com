import AIAgentChat from '@/components/AIAgentChat';

const RichardHeartPage: React.FC = () => {
  const quickQuestions = [
    "What's your take on the current crypto market?",
    "Tell me about PulseChain and its vision",
    "What's your philosophy on life and success?",
    "How do you stay motivated in tough times?",
    "What's your advice for crypto newcomers?"
  ];

  return (
    <AIAgentChat
      agentEndpoint="richard-heart"
      title="Talk to Richard Heart!"
      description="AI-powered conversation with the crypto legend and PulseChain founder"
      quickQuestions={quickQuestions}
    />
  );
};

export default RichardHeartPage;