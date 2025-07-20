import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the API key from session storage or fall back to environment variable
 * @param request - The NextRequest object to access headers
 * @returns The API key string
 */
export function getApiKey(request?: Request): string {
  // First, try to get from session storage via request headers
  if (request) {
    const userApiKey = request.headers.get('x-user-api-key');
    if (userApiKey && userApiKey.trim()) {
      return userApiKey.trim();
    }
  }
  
  // Fall back to environment variable
  const envApiKey = process.env.GEMINI_API_KEY;
  if (!envApiKey) {
    throw new Error('No API key available. Please configure GEMINI_API_KEY environment variable or set a personal API key.');
  }
  
  return envApiKey;
}