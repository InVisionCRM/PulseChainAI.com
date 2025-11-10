import RichardHeartChatCard from '@/components/RichardHeartChatCard';

const RichardHeartPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-900 to-fuchsia-800 flex items-center justify-center p-6">
      <RichardHeartChatCard className="w-full max-w-md" />
    </div>
  );
};

export default RichardHeartPage;
