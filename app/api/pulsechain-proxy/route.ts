import { NextRequest, NextResponse } from 'next/server';

const PULSECHAIN_API_BASE = 'https://scan.pulsechain.com/api/v2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const query = searchParams.get('query');
    
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint parameter is required' },
        { status: 400 }
      );
    }

    // Validate endpoint to prevent SSRF attacks
    if (!endpoint.startsWith('/') || endpoint.includes('..') || endpoint.includes('//')) {
      return NextResponse.json(
        { error: 'Invalid endpoint parameter' },
        { status: 400 }
      );
    }

    // Build the URL with query parameters
    const url = new URL(`${PULSECHAIN_API_BASE}${endpoint}`);
    
    // Add all search params except 'endpoint' to the target URL
    searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
        url.searchParams.append(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PulseChain-AI-Dashboard/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`PulseChain API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('PulseChain proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    if (!endpoint.startsWith('/') || endpoint.includes('..') || endpoint.includes('//')) {
      return NextResponse.json(
        { error: 'Invalid endpoint parameter' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const url = `${PULSECHAIN_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'PulseChain-AI-Dashboard/1.0'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`PulseChain API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('PulseChain proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
} 