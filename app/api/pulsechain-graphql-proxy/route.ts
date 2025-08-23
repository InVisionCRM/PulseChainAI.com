import { NextRequest, NextResponse } from 'next/server';

const PULSECHAIN_GRAPHQL_ENDPOINTS = [
  'https://graph.pulsechain.com/subgraphs/name/Codeakk/Hex',
  'https://graph.pulsechain.com/subgraphs/name/hex/hex-staking',
  'https://api.thegraph.com/subgraphs/name/pulsechain/hex-staking'
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, variables } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'GraphQL query is required' },
        { status: 400 }
      );
    }

    // Try each endpoint until one works
    for (const endpoint of PULSECHAIN_GRAPHQL_ENDPOINTS) {
      try {
        console.log(`Trying PulseChain GraphQL endpoint: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'PulseChain-AI-Dashboard/1.0'
          },
          body: JSON.stringify({
            query,
            variables: variables || {}
          })
        });

        if (!response.ok) {
          console.log(`Endpoint ${endpoint} failed with status: ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        // Check if GraphQL returned errors
        if (data.errors && data.errors.length > 0) {
          console.log(`GraphQL errors from ${endpoint}:`, data.errors);
          continue;
        }

        console.log(`✅ Successfully connected to PulseChain endpoint: ${endpoint}`);
        return NextResponse.json(data);

      } catch (error) {
        console.log(`Endpoint ${endpoint} failed:`, error);
        continue;
      }
    }

    // All endpoints failed
    return NextResponse.json(
      { error: 'All PulseChain GraphQL endpoints are unavailable' },
      { status: 503 }
    );

  } catch (error) {
    console.error('PulseChain GraphQL proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}