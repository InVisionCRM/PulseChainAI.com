import AIAgentChat from '@/components/AIAgentChat';

const JamesWilsonPage: React.FC = () => {
  const quickQuestions = [
    "How do I build an engaged crypto community?",
    "What are the best Discord management strategies?",
    "How do I handle community conflicts?",
    "What makes a successful DAO governance?",
    "How do I grow a community organically?"
  ];

  return (
    <AIAgentChat
      agentEndpoint="james-wilson"
      title="James Wilson - Community Building Expert"
      description="Expert in community building, Discord management, and DAO governance"
      quickQuestions={quickQuestions}
    />
  );
};

export default JamesWilsonPage;