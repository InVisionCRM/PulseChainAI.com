# Gemini 2.5 Flash API Setup

This project is configured to use Google's Gemini 2.5 Flash API with the following features:

## Configuration

- **Model**: `gemini-2.0-flash-exp` (Gemini 2.5 Flash)
- **Thinking Budget**: 1000 steps
- **Grounding**: Enabled with Google Search
- **Safety Settings**: Configured for content moderation
- **Function Calling**: Enabled

## Environment Setup

1. Create a `.env.local` file in the root directory
2. Add your Gemini API key:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

### Getting Your API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key and add it to your `.env.local` file as `GEMINI_API_KEY`

## Usage

### Using the React Hook

```typescript
import { useGemini } from '@/lib/hooks/useGemini';

function MyComponent() {
  const { generate, isLoading, error } = useGemini({
    thinkingBudget: 1000,
    isChat: false
  });

  const handleGenerate = async () => {
    try {
      const response = await generate('Your prompt here');
      console.log(response);
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate'}
      </button>
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

### Direct API Usage

```typescript
import { generateWithThinkingBudget } from '@/lib/gemini';

const response = await generateWithThinkingBudget('Your prompt', 1000);
```

### API Endpoint

- **POST** `/api/gemini`
- **Body**: `{ prompt: string, thinkingBudget?: number, isChat?: boolean }`
- **Response**: `{ response: string }`

## Features

### Thinking Budget
The API is configured with a thinking budget of 1000 steps, allowing the model to think through complex problems step-by-step.

### Grounding with Google Search
The model can access real-time information through Google Search to provide more accurate and up-to-date responses.

### Safety Settings
Content is filtered through safety settings to prevent harmful content generation.

### Function Calling
The model can call functions and use tools as needed for enhanced capabilities.

## Error Handling

The API includes comprehensive error handling for:
- Missing API keys
- Invalid prompts
- Network errors
- Rate limiting
- Content policy violations

## Testing

You can test the API by visiting `/api/gemini` in your browser to see the configuration status. 