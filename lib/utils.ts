import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiKey(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Fallback: check for API key in query params or body
  const url = new URL(request.url);
  const apiKey = url.searchParams.get('apiKey');
  if (apiKey) {
    return apiKey;
  }
  
  return null;
}

/**
 * Formats a token amount by adjusting for decimal places
 * @param rawAmount - The raw amount as a string or number (e.g., "1000000000000000000" for 1 token with 18 decimals)
 * @param decimals - The number of decimal places for the token (default: 18)
 * @returns Formatted string representation of the token amount
 */
export function formatTokenAmount(rawAmount: string | number, decimals: string | number = 18): string {
  if (!rawAmount || rawAmount === 'N/A' || rawAmount === '0') return '0';
  
  try {
    const decimalsNum = typeof decimals === 'string' ? parseInt(decimals) : decimals;
    const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;
    
    if (isNaN(amount) || isNaN(decimalsNum)) return 'N/A';
    
    // Adjust for decimal places
    const adjustedAmount = amount / Math.pow(10, decimalsNum);
    
    // Format with appropriate decimal places
    if (adjustedAmount === 0) return '0';
    if (adjustedAmount < 0.000001) return adjustedAmount.toExponential(2);
    if (adjustedAmount < 1) return adjustedAmount.toFixed(6);
    if (adjustedAmount < 1000) return adjustedAmount.toFixed(2);
    
    return adjustedAmount.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  } catch (error) {
    console.warn('Error formatting token amount:', error);
    return 'N/A';
  }
}
