# AI Code Reader/Chat Bot

A comprehensive AI-powered contract analysis tool built with Next.js, TypeScript, and Tailwind CSS.

## Features

### 🚀 Core Functionality
- **Contract Analysis**: Load and analyze smart contracts from PulseChain
- **AI-Powered Chat**: Interactive chat interface for contract queries using Gemini AI
- **Function Explanation**: AI-generated explanations of contract functions
- **Token Information**: Detailed token data and market information
- **Creator Analysis**: Track contract creators and their activities
- **Real-time Streaming**: Live AI responses with streaming text

### 📊 Dashboard Components

#### 1. **Contract Overview**
- Contract verification status
- Compiler version and optimization settings
- Owner address detection
- Basic contract metadata

#### 2. **Token Information Card**
- Token name, symbol, and icon
- Total supply and decimals
- Market cap and exchange rate
- Holder count and token type

#### 3. **Function Analysis**
- **Read Functions**: View-only functions with AI explanations
- **Write Functions**: State-changing functions with detailed analysis
- Collapsible function details with input/output specifications

#### 4. **Creator Tab**
- Contract creator address and creation transaction
- Token holdings by the creator
- Other contracts created by the same address
- Transaction history and analysis

#### 5. **Source Code Viewer**
- Syntax-highlighted Solidity code
- Scrollable interface for large contracts
- Copy-friendly formatting

#### 6. **API Response Tab**
- Raw API responses from PulseChain Scan
- Multiple endpoint data (contract, token, address info)
- JSON viewer with collapsible sections

#### 7. **AI Chat Interface**
- Real-time chat with AI about contract analysis
- Context-aware responses based on loaded contract
- Message history and streaming responses

## 🛠 Technical Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS with custom components
- **Icons**: Custom SVG icons with TypeScript interfaces
- **State Management**: React hooks with proper TypeScript typing
- **API Integration**: Real Gemini AI integration for chat and analysis

## 📁 File Structure

```
app/
├── ai-agent/
│   └── page.tsx              # Main AI agent page
├── page.tsx                  # Home page with navigation
└── globals.css              # Global styles and animations

components/
├── icons/
│   ├── LoadingSpinner.tsx    # Loading animation component
│   ├── SendIcon.tsx          # Chat send button icon
│   └── PulseChainLogo.tsx    # Brand logo component
├── AbiFunctionsList.tsx      # Function analysis component
├── ApiResponseTab.tsx        # API response viewer
├── CreatorTab.tsx           # Creator analysis component
├── JsonViewer.tsx           # JSON data viewer
└── TokenInfoCard.tsx        # Token information display

services/
└── pulsechainService.ts     # API service layer (mock implementation)

types.ts                     # TypeScript type definitions
```

## 🎨 Design Features

### Responsive Design
- Mobile-first approach with responsive breakpoints
- Adaptive layouts for different screen sizes
- Touch-friendly interface elements

### Dark Theme
- Consistent dark color scheme throughout
- Purple accent colors for brand consistency
- High contrast for accessibility

### Animations
- Smooth transitions and hover effects
- Loading animations with custom spinners
- Chat message animations
- Tab switching animations

### Accessibility
- ARIA labels and roles for screen readers
- Keyboard navigation support
- Focus management for interactive elements
- Color contrast compliance

## 🔧 Configuration

### Environment Setup
1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. Access AI agent at: `http://localhost:3000/ai-agent`

### TypeScript Configuration
- Strict mode enabled
- Proper type definitions for all components
- Interface-based prop validation
- Generic type support for API responses

### Tailwind Configuration
- Custom color palette with purple theme
- Responsive utility classes
- Custom animations and transitions
- Component-specific styling

## 🚀 Getting Started

1. **Navigate to the AI Agent**:
   - Click the "Try AI Agent →" button on the home page
   - Or directly visit `/ai-agent`

2. **Load a Contract**:
   - Enter a contract address or search for tokens
   - Use the search dropdown for suggestions
   - Click "Load Contract" to analyze

3. **Explore Features**:
   - Switch between tabs to view different aspects
   - Use the chat interface to ask questions
   - Examine function explanations and API responses

## 🔮 Future Enhancements

### Planned Features
- Real PulseChain API integration
- Advanced AI analysis with security insights
- Contract comparison tools
- Export functionality for reports
- Real-time blockchain data updates

### Technical Improvements
- WebSocket integration for live updates
- Caching layer for API responses
- Advanced search filters
- Multi-chain support
- Performance optimizations

## 📝 Contributing

1. Follow TypeScript best practices
2. Use proper component composition
3. Maintain accessibility standards
4. Add comprehensive error handling
5. Write clear documentation

## 📄 License

This project is part of the PulseChain AI Dashboard and follows the same licensing terms. 