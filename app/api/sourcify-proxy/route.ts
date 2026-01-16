import { NextRequest, NextResponse } from 'next/server';

const SOURCIFY_REPO_BASE = 'https://repo.sourcify.dev/contracts';
const SOURCIFY_SERVER_BASE = 'https://sourcify.dev/server/repository/contracts';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId');
    const address = searchParams.get('address');
    const type = searchParams.get('type'); // 'metadata' or 'files' or 'source'
    const filePath = searchParams.get('filePath'); // For individual source files
    
    if (!chainId || !address) {
      return NextResponse.json(
        { error: 'chainId and address parameters are required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }

    // Validate chainId
    const chainIdNum = parseInt(chainId);
    if (isNaN(chainIdNum) || chainIdNum < 1) {
      return NextResponse.json(
        { error: 'Invalid chainId' },
        { status: 400 }
      );
    }

    let url: string;
    
    if (type === 'files') {
      // Fetch all files
      url = `${SOURCIFY_REPO_BASE}/full_match/${chainId}/${address}/files`;
    } else if (type === 'source' && filePath) {
      // Fetch individual source file
      const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
      url = `${SOURCIFY_REPO_BASE}/full_match/${chainId}/${address}/sources/${encodedPath}`;
    } else {
      // Default: fetch metadata
      url = `${SOURCIFY_REPO_BASE}/full_match/${chainId}/${address}/metadata.json`;
    }

    console.log('Fetching from Sourcify:', url);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'PulseChain-AI-Dashboard/1.0'
      },
      // Don't cache to ensure fresh data
      cache: 'no-store'
    });

    // If repo fails, try server endpoint for metadata
    if (!response.ok && type === 'metadata') {
      const serverUrl = `${SOURCIFY_SERVER_BASE}/full_match/${chainId}/${address}/metadata.json`;
      console.log('Repo failed, trying Sourcify server:', serverUrl);
      
      const serverResponse = await fetch(serverUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PulseChain-AI-Dashboard/1.0'
        },
        cache: 'no-store'
      });

      if (serverResponse.ok) {
        const data = await serverResponse.json();
        return NextResponse.json(data, {
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Sourcify API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // For source files, return as text; for JSON (metadata/files), return as JSON
    if (type === 'source') {
      const text = await response.text();
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Sourcify proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
