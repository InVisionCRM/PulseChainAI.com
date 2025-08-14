import { NextRequest, NextResponse } from 'next/server';

const HEX_API_BASE = 'https://hexdailystats.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint parameter is required' },
        { status: 400 }
      );
    }

    // Validate endpoint to prevent SSRF attacks
    const allowedEndpoints = ['fulldata', 'fulldatapulsechain', 'livedata'];
    if (!allowedEndpoints.includes(endpoint)) {
      return NextResponse.json(
        { error: 'Invalid endpoint parameter' },
        { status: 400 }
      );
    }

    const url = `${HEX_API_BASE}/${endpoint}`;
    console.log('Fetching from HEX API:', url);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      cache: 'no-store', // Ensure fresh data
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      console.error(`HEX API error: ${response.status} ${response.statusText}`);
      throw new Error(`HEX API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Set appropriate cache headers based on endpoint
    const cacheAge = endpoint === 'livedata' ? 60 : 300; // 1 min for live, 5 min for historical
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, max-age=${cacheAge}`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error in HEX proxy:', {
      endpoint,
      error: error.message,
      stack: error.stack
    });
    
    // Return more specific error information
    let errorMessage = 'Failed to fetch HEX data';
    let statusCode = 500;
    
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      errorMessage = 'Request timeout - HEX API is slow to respond';
      statusCode = 504;
    } else if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
      errorMessage = 'Network error - Unable to connect to HEX API';
      statusCode = 502;
    } else if (error.message.includes('CORS')) {
      errorMessage = 'CORS error - API access restricted';
      statusCode = 403;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: error.message,
        endpoint,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}