import AIAgentChat from '@/components/AIAgentChat';

const MayaPatelPage: React.FC = () => {
  const quickQuestions = [
    "What are the most reliable chart patterns?",
    "How do I identify support and resistance levels?",
    "What technical indicators should I use?",
    "How do I manage risk in trading?",
    "What's the best timeframe for analysis?"
  ];

  return (
    <AIAgentChat
      agentEndpoint="maya-patel"
      title="Maya Patel - Technical Analysis Specialist"
      description="Expert in technical analysis, chart patterns, and trading strategies"
      quickQuestions={quickQuestions}
    />
  );
};

export default MayaPatelPage;