import AIAgentChat from '@/components/AIAgentChat';

const MarcusJohnsonPage: React.FC = () => {
  const quickQuestions = [
    "What is the philosophical foundation of blockchain technology?",
    "How does decentralization promote individual sovereignty?",
    "What are the ethical implications of cryptocurrency?",
    "How does blockchain technology challenge traditional financial systems?",
    "What is the future of money and digital sovereignty?"
  ];

  return (
    <AIAgentChat
      agentEndpoint="marcus-johnson"
      title="Dr. Marcus Johnson - Blockchain Philosophy Expert"
      description="Expert in blockchain philosophy, decentralization, and digital sovereignty"
      quickQuestions={quickQuestions}
    />
  );
};

export default MarcusJohnsonPage;