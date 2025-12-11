# Stat Documentation System

A comprehensive API documentation system for all 100+ PulseChain stats, automatically generating documentation, code examples, and interactive testing capabilities.

## Overview

This system provides API-reference-style documentation for every stat in your application, similar to professional API documentation platforms. Each stat gets:

- **Full parameter documentation** (automatically detected based on stat ID patterns)
- **Code examples** in 4 languages (cURL, JavaScript, TypeScript, Python)
- **Response schema documentation**
- **HTTP status codes**
- **Interactive testing** (via AdminStatsPanel integration)

## Features

### 🎯 Automatic Parameter Detection

The system intelligently detects required parameters for each stat based on naming patterns:

- **Token Address** - Always included as primary parameter
- **Transaction Hash** - For `transaction*` stats
- **Block Number** - For `block*` stats  
- **Address Hash** - For `address*` stats
- **Wallet Address** - For `tokenBalance` stat
- **Pagination** - For list/history endpoints
- And more...

### 📝 Auto-Generated Code Examples

Each stat documentation includes ready-to-use code examples:

```bash
# cURL
curl --request GET \
  --url 'https://yoursite.com/api/stats/totalSupply?address=0x...' \
  --header 'accept: application/json'
```

```javascript
// JavaScript/Node.js
const response = await fetch(
  'https://yoursite.com/api/stats/totalSupply?address=0x...',
  { headers: { 'accept': 'application/json' } }
);
const data = await response.json();
```

```typescript
// TypeScript with types
interface StatResult {
  value: any;
  formattedValue: string;
  lastUpdated: Date;
  source: string;
}
```

```python
# Python
import requests
response = requests.get('https://yoursite.com/api/stats/totalSupply?address=0x...')
data = response.json()
```

### 🔗 Seamless Integration

- **AdminStatsPanel** - Added "📖 API Docs" button in header
- **Stat Descriptions** - Each selected stat shows "View Full Documentation" link
- **Direct Links** - Can link directly to any stat: `/stat-docs/{statId}`

## File Structure

```
lib/stat-docs/
├── parameter-detector.ts    # Detects parameters for each stat
├── code-generator.ts         # Generates code examples in multiple languages
└── README.md                 # This file

components/stat-docs/
├── StatDocHeader.tsx         # Documentation page header
├── ParametersSection.tsx     # Parameters display
├── CodeExamplesSection.tsx   # Code examples with tabs
├── ResponseSchemaSection.tsx # Response structure docs
└── StatusCodesSection.tsx    # HTTP status codes

app/stat-docs/
├── page.tsx                  # Index page - lists all stats
└── [statId]/
    └── page.tsx             # Dynamic route - individual stat docs
```

## Usage

### Viewing Documentation

1. **Browse All Stats**: Navigate to `/stat-docs`
   - Search by name, ID, or description
   - Filter by format type (number, currency, percentage, etc.)
   - View parameter requirements at a glance

2. **View Individual Stat**: Click any stat or go to `/stat-docs/{statId}`
   - Full parameter documentation
   - Code examples in 4 languages
   - Response schema
   - HTTP status codes
   - Direct link to test in Admin Panel

3. **From Admin Panel**: 
   - Click "📖 API Docs" in header to view all stats
   - Select a stat and click "📖 View Full Documentation" to see that stat's docs

### Adding New Stats

The system automatically generates documentation for any stat in `lib/stats/index.ts`. No manual configuration needed!

Just ensure your stat follows the standard structure:

```typescript
export const myNewStat = {
  id: 'myNewStat',
  name: 'My New Stat',
  description: 'Description of what this stat does',
  enabled: true,
  format: 'number',
  fetch: async (tokenAddress: string) => {
    // implementation
    return {
      value: rawValue,
      formattedValue: formattedValue,
      lastUpdated: new Date(),
      source: 'pulsechain'
    };
  },
  getConfig: () => ({ /* config */ })
};
```

### Customizing Parameter Detection

To add custom parameter logic, edit `lib/stat-docs/parameter-detector.ts`:

```typescript
export function detectStatParameters(statId: string): StatParameter[] {
  // Add your custom logic
  if (statId === 'myCustomStat') {
    parameters.push({
      key: 'customParam',
      label: 'Custom Parameter',
      type: 'string',
      required: true,
      description: 'Description of parameter',
      placeholder: 'Example value',
      example: 'example-value'
    });
  }
}
```

## Configuration

### Base URL

The code examples use the current domain automatically. To change the base URL for examples:

```typescript
// In app/stat-docs/[statId]/page.tsx
const baseUrl = 'https://your-custom-domain.com';
```

### Styling

All components use Tailwind CSS classes matching your existing design system:
- Slate/purple color scheme
- Backdrop blur effects
- Responsive design
- Dark mode optimized

## API Response Format

All stats return a standardized response:

```json
{
  "value": any,              // Raw stat value
  "formattedValue": string,  // Human-readable formatted value
  "lastUpdated": Date,       // Timestamp
  "source": string,          // Data source (e.g., "pulsechain")
  "error"?: string           // Optional error message
}
```

## HTTP Status Codes

- **200** - Success
- **400** - Bad Request (invalid parameters)
- **404** - Not Found (stat/token doesn't exist)
- **429** - Too Many Requests (rate limit)
- **500** - Internal Server Error

## Notes

- ✅ **PulseChain Only** - No chain parameter needed
- ✅ **No API Key** - No authentication required
- ✅ **100+ Stats** - All stats auto-documented
- ✅ **Real-time Testing** - Integrated with AdminStatsPanel
- ✅ **Type Safe** - Full TypeScript support

## Future Enhancements

Potential additions:
- [ ] API playground with live testing directly in docs
- [ ] Rate limiting documentation
- [ ] Batch request examples
- [ ] WebSocket examples for real-time data
- [ ] Export documentation to OpenAPI/Swagger spec
- [ ] Add "Try It" button in documentation pages

