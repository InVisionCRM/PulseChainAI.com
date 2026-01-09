export interface TokenData {
  rank: number;
  dexIcon: string;
  tokenIcon: string;
  symbol: string;
  name: string;
  price: string;
  txns: string;
  volume: string;
  liquidity: string;
  priceChange24h: string;
  fdv: string;
  pairAddress: string;
  tokenAddress?: string;
  dexName: string;
  socials?: Array<{ type: string; url: string }>;
}

export function parseCSV(csvText: string): TokenData[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1)
    .filter(line => line.trim())
    .map((line, index) => {
      const values = parseCSVLine(line);

      // Extract pair address from URL
      const url = values[0].replace(/"/g, '');
      const pairAddress = url.split('/').pop() || '';

      return {
        rank: index + 1,
        dexIcon: values[2].replace(/"/g, ''),
        tokenIcon: values[3].replace(/"/g, ''),
        symbol: values[5].replace(/"/g, ''),
        name: values[7].replace(/"/g, ''),
        price: values[8].replace(/"/g, ''),
        txns: values[10].replace(/"/g, ''),
        volume: values[11].replace(/"/g, ''),
        liquidity: values[12].replace(/"/g, ''),
        priceChange24h: values[16].replace(/"/g, ''),
        fdv: values[17].replace(/"/g, ''),
        pairAddress,
        dexName: 'PulseChain'
      };
    });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}