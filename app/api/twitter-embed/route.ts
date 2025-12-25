export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || 'morbius_io';

    const embedUrl = `https://publish.twitter.com/oembed?url=https://twitter.com/${username}&theme=dark&limit=5&maxwidth=400&chrome=noheader%20noborders`;

    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Morbius-App/1.0',
      },
    });

    if (!response.ok) {
      console.error('Twitter API error:', response.status, response.statusText);
      return Response.json(
        { error: 'Failed to fetch Twitter embed', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.html) {
      console.error('Twitter API returned no HTML:', data);
      return Response.json(
        { error: 'No embed HTML received from Twitter' },
        { status: 502 }
      );
    }

    // Set caching headers based on Twitter's cache_age (default to 1 hour if not provided)
    const cacheAge = data.cache_age ? parseInt(data.cache_age) : 3600;

    return Response.json(data, {
      headers: {
        'Cache-Control': `public, max-age=${cacheAge}`,
        'CDN-Cache-Control': `max-age=${cacheAge}`,
        'Vercel-CDN-Cache-Control': `max-age=${cacheAge}`,
      },
    });
  } catch (error) {
    console.error('Twitter embed API route error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


