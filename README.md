# 🔍 PulseChain AI Contract Analyzer

A sophisticated AI-powered smart contract analysis tool built for the PulseChain blockchain. This application combines blockchain data retrieval with artificial intelligence to provide comprehensive contract insights, function explanations, and interactive chat capabilities.

![PulseChain AI Contract Analyzer](https://img.shields.io/badge/PulseChain-AI%20Analyzer-purple?style=for-the-badge&logo=ethereum)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=for-the-badge&logo=tailwind-css)
![Google Gemini](https://img.shields.io/badge/Gemini-2.5--Flash-orange?style=for-the-badge&logo=google)

## ✨ Features

### 🤖 AI-Powered Analysis
- **Intelligent Function Explanation**: AI analyzes contract ABI and source code to provide human-readable explanations of each function
- **Interactive Chat Interface**: Ask questions about loaded contracts and get AI-powered responses
- **Context-Aware Responses**: AI considers full contract source code when answering questions
- **Real-time Streaming**: Chat responses stream in real-time for better user experience

### 📊 Comprehensive Contract Data
- **Contract Verification**: Validates and retrieves verified smart contract data
- **Token Information**: Detailed token metadata including supply, holders, market cap
- **ABI Analysis**: Complete Application Binary Interface breakdown with function types
- **Source Code Display**: Full contract source code with syntax highlighting

### 🔍 Advanced Search & Discovery
- **Smart Search**: Search contracts, tokens, and addresses with real-time suggestions
- **Address Validation**: Automatic validation of Ethereum/PulseChain addresses
- **Debounced Search**: Optimized search with 300ms debounce for better performance

### 👤 Creator Analysis
- **Contract Creator Tracking**: Find and analyze contract creators
- **Transaction History**: View creator's contract creation transactions
- **Token Balances**: Check creator's token holdings for the analyzed contract
- **Address Information**: Comprehensive creator address details

### 📈 Live Contract Data
- **Read Method Execution**: Execute read-only contract methods with live values
- **Owner Detection**: Automatically detect contract ownership
- **Real-time Values**: Fetch current contract state and token balances
- **API Response Logging**: Full API response tracking for debugging

### 🎨 Modern UI/UX
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Dark Theme**: Professional dark interface with purple accent colors
- **Tabbed Interface**: Organized data presentation with multiple tabs
- **Loading States**: Smooth loading animations and progress indicators
- **Error Handling**: Comprehensive error messages and fallback states

## 🏗️ Architecture

### Frontend Stack
- **Next.js 14**: React framework with App Router and server-side rendering
- **TypeScript**: Strict type safety and enhanced developer experience
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **React Hooks**: Modern React patterns for state management

### Backend Services
- **Google Gemini AI**: Advanced AI model for contract analysis and chat
- **PulseChain API**: Blockchain data retrieval from official scan API
- **Next.js API Routes**: Serverless API endpoints for AI processing

### Key Components
```
├── app/
│   ├── page.tsx              # Main application interface
│   ├── api/
│   │   ├── analyze/route.ts  # AI contract analysis endpoint
│   │   └── chat/route.ts     # AI chat streaming endpoint
│   └── layout.tsx            # Root layout with metadata
├── components/
│   ├── AbiFunctionsList.tsx  # Function display with AI explanations
│   ├── TokenInfoCard.tsx     # Token metadata display
│   ├── CreatorTab.tsx        # Creator analysis interface
│   ├── ApiResponseTab.tsx    # Raw API response viewer
│   └── icons/                # Custom SVG icons
├── services/
│   └── pulsechainService.ts  # Blockchain API integration
└── types.ts                  # TypeScript type definitions
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn** package manager
- **Google Gemini API Key** ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pulsechain-contract-analyzer.git
   cd pulsechain-contract-analyzer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Create environment file
   cp .env.example .env.local
   
   # Add your Gemini API key
   echo "API_KEY=your_gemini_api_key_here" >> .env.local
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage Guide

### Basic Contract Analysis

1. **Enter Contract Address**
   - Paste a PulseChain contract address in the search field
   - Use the default demo address or enter your own
   - Address format: `0x...` (40 character hex string)

2. **Load Contract Data**
   - Click "Load Contract" to fetch contract information
   - Wait for AI analysis to complete
   - View results across multiple tabs

3. **Explore Functions Tab**
   - Browse all contract functions with AI explanations
   - Expand function details to see parameters and outputs
   - Distinguish between read and write functions

### Advanced Features

#### AI Chat Interface
- **Ask Questions**: Type questions about the loaded contract
- **Get Explanations**: AI provides detailed responses based on source code
- **Streaming Responses**: Watch responses appear in real-time
- **Context Awareness**: AI considers full contract context

#### Creator Analysis
- **View Creator Info**: See who deployed the contract
- **Transaction History**: Browse creator's contract creation transactions
- **Token Holdings**: Check if creator holds tokens from the contract

#### API Response Debugging
- **Raw Data View**: Access complete API responses
- **Debug Information**: Useful for developers and power users
- **Response Logging**: Track all API calls and responses

### Search Functionality

- **Smart Search**: Type partial names or addresses
- **Real-time Results**: See suggestions as you type
- **Multiple Types**: Search contracts, tokens, addresses, blocks, transactions
- **Quick Selection**: Click results to auto-fill address field

## 🔧 Configuration

### Environment Variables

```bash
# Required
API_KEY=your_gemini_api_key_here

# Optional
NEXT_PUBLIC_API_BASE_URL=https://api.scan.pulsechain.com/api/v2/
NODE_ENV=development
```

### Customization

#### Styling
- Modify `tailwind.config.js` for theme customization
- Update color scheme in `app/globals.css`
- Customize component styles in individual component files

#### API Endpoints
- Update `API_BASE_URL` in `services/pulsechainService.ts`
- Modify API response handling for different blockchain networks
- Add new API endpoints as needed

#### AI Configuration
- Adjust AI prompts in `app/api/analyze/route.ts`
- Modify chat system instructions in `app/api/chat/route.ts`
- Change AI model parameters for different use cases

## 🧪 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Type checking
npx tsc --noEmit     # TypeScript type checking
```

### Project Structure

```
pulsechainaicom/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── icons/            # SVG icons
│   └── *.tsx             # UI components
├── services/             # External API services
├── types.ts              # TypeScript definitions
├── tailwind.config.js    # Tailwind configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

### Code Quality

- **TypeScript**: Strict mode enabled with comprehensive type definitions
- **ESLint**: Code linting with Next.js recommended rules
- **Prettier**: Automatic code formatting
- **Component Architecture**: Modular, reusable components
- **Error Handling**: Comprehensive error boundaries and fallbacks

## 🌐 API Integration

### PulseChain API Endpoints

The application integrates with the official PulseChain scan API:

- `GET /smart-contracts/{address}` - Contract verification data
- `GET /tokens/{address}` - Token information
- `GET /smart-contracts/{address}/methods-read` - Read method execution
- `GET /addresses/{address}/transactions` - Transaction history
- `GET /addresses/{address}/token-balances` - Token balances
- `GET /search` - Global search functionality

### AI Integration

- **Google Gemini 2.5 Flash**: Fast, efficient AI model for analysis
- **Structured Output**: JSON schema validation for consistent responses
- **Streaming Chat**: Real-time conversation capabilities
- **Context Management**: Maintains conversation history and contract context

## 🔒 Security Considerations

- **API Key Protection**: Environment variables for sensitive data
- **Input Validation**: Address format validation and sanitization
- **Error Handling**: Graceful error handling without exposing internals
- **Rate Limiting**: Built-in debouncing for API calls
- **CORS Configuration**: Proper cross-origin resource sharing setup

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect Repository**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel
   ```

2. **Environment Variables**
   - Add `API_KEY` in Vercel dashboard
   - Configure production environment

3. **Custom Domain** (Optional)
   - Add custom domain in Vercel settings
   - Configure DNS records

### Other Platforms

- **Netlify**: Compatible with Next.js static export
- **Railway**: Full-stack deployment with environment variables
- **Docker**: Containerized deployment option

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow the existing code style
4. **Add tests**: Ensure new features are properly tested
5. **Commit changes**: Use conventional commit messages
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**: Provide detailed description and screenshots

### Development Guidelines

- **TypeScript**: Use strict typing, avoid `any`
- **Components**: Create reusable, modular components
- **Styling**: Use Tailwind CSS utility classes
- **Testing**: Write meaningful tests for new features
- **Documentation**: Update README for new features

## 📄 License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0) - see the [LICENSE](LICENSE.md) file for details.

**Important:** This license ensures that any derivative works must also remain open source under the same GPL-3.0 license.

## 🙏 Acknowledgments

- **PulseChain Team**: For the excellent blockchain explorer API
- **Google AI**: For providing the Gemini AI model
- **Next.js Team**: For the amazing React framework
- **Tailwind CSS**: For the utility-first CSS framework
- **Open Source Community**: For all the amazing tools and libraries

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/pulsechain-contract-analyzer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/pulsechain-contract-analyzer/discussions)
- **Email**: your-email@example.com

## 🔄 Changelog

### v0.1.0 (Current)
- ✨ Initial release with AI contract analysis
- 🤖 Google Gemini AI integration
- 📊 Comprehensive contract data display
- 🔍 Advanced search functionality
- 👤 Creator analysis features
- 💬 Interactive AI chat interface
- 🎨 Modern responsive UI design

---

**Built with ❤️ for the PulseChain community**

*This tool helps developers and users understand smart contracts on PulseChain through the power of artificial intelligence.*
