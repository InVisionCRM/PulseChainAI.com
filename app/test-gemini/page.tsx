import GeminiTest from "@/components/GeminiTest";

export default function TestGeminiPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Gemini 2.5 Flash API Test</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            This page tests the Gemini 2.5 Flash API integration with thinking budget of 1000 steps 
            and grounding enabled with Google Search. Make sure you have set up your GEMINI_API_KEY 
            in the .env.local file.
          </p>
        </div>
        
        <GeminiTest />
        
        <div className="max-w-2xl mx-auto mt-8 p-6 bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800">
          <h3 className="text-xl font-bold text-white mb-4">Setup Instructions</h3>
          <div className="space-y-3 text-gray-300 text-sm">
            <p>1. Create a <code className="bg-gray-800 px-2 py-1 rounded">.env.local</code> file in the root directory</p>
            <p>2. Add your Gemini API key: <code className="bg-gray-800 px-2 py-1 rounded">GEMINI_API_KEY=your_key_here</code></p>
            <p>3. Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a></p>
            <p>4. Restart your development server</p>
          </div>
        </div>
      </div>
    </div>
  );
} 