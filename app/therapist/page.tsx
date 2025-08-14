import AIAgentChat from '@/components/AIAgentChat';

const TherapistPage: React.FC = () => {
  const quickQuestions = [
    "I'm feeling overwhelmed and need someone to talk to",
    "I'm struggling with anxiety and stress",
    "I want to work on my self-confidence",
    "I'm dealing with relationship challenges",
    "I need help with mindfulness and relaxation"
  ];

  return (
    <AIAgentChat
      agentEndpoint="therapist"
      title="AI Therapist - Emotional Support"
      description="Compassionate AI therapist providing emotional support and therapeutic guidance"
      quickQuestions={quickQuestions}
    />
  );
};

export default TherapistPage;