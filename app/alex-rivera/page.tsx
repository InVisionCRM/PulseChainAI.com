import AIAgentChat from '@/components/AIAgentChat';

const AlexRiveraPage: React.FC = () => {
  const quickQuestions = [
    "What are the best practices for Solidity security?",
    "How do I optimize gas usage in smart contracts?", 
    "What are common DeFi protocol vulnerabilities?",
    "How do I design a secure token contract?",
    "What's the future of smart contract development?"
  ];

  return (
    <AIAgentChat
      agentEndpoint="alex-rivera"
      title="Alex Rivera - Smart Contract Developer"
      description="Expert in Solidity, smart contract security, and DeFi protocols"
      quickQuestions={quickQuestions}
    />
  );
};

export default AlexRiveraPage;