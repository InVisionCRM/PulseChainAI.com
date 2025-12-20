export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || 'morbius_io';
    const count = searchParams.get('count') || '1';

    // Check for rate limiting - return cached response if available
    // For now, we'll implement a simple in-memory cache
    const cacheKey = `${username}-${count}`;
    const cachedResponse = getCachedResponse(cacheKey);

    if (cachedResponse) {
      return Response.json(cachedResponse);
    }

    // Get user ID first
    const userResponse = await fetch(`https://api.twitter.com/2/users/by/username/${username}`, {
      headers: {
        'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userResponse.ok) {
      console.error('Twitter API user lookup error:', userResponse.status, userResponse.statusText);

      // Return error for rate limits
      if (userResponse.status === 429) {
        return Response.json(
          { error: 'Rate limited' },
          { status: 429 }
        );
      }

      return Response.json(
        { error: 'Failed to find user', status: userResponse.status },
        { status: userResponse.status }
      );
    }

    const userData = await userResponse.json();

    if (!userData.data) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = userData.data.id;

    // Get recent tweets
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=${count}&tweet.fields=created_at,public_metrics,text,entities&exclude=replies,retweets`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!tweetsResponse.ok) {
      console.error('Twitter API tweets error:', tweetsResponse.status, tweetsResponse.statusText);

      // Return error for rate limits or other errors
      if (tweetsResponse.status === 429) {
        return Response.json(
          { error: 'Rate limited' },
          { status: 429 }
        );
      }
      if (tweetsResponse.status >= 500) {
        return Response.json(
          { error: 'Twitter API error' },
          { status: tweetsResponse.status }
        );
      }

      return Response.json(
        { error: 'Failed to fetch tweets', status: tweetsResponse.status },
        { status: tweetsResponse.status }
      );
    }

    const tweetsData = await tweetsResponse.json();

    // Cache the response
    setCachedResponse(cacheKey, tweetsData, 300); // Cache for 5 minutes

    return Response.json(tweetsData, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'CDN-Cache-Control': 'max-age=300',
        'Vercel-CDN-Cache-Control': 'max-age=300',
      },
    });
  } catch (error) {
    console.error('Recent tweets API route error:', error);

    // Return error on API failure
    return Response.json(
      { error: 'API error' },
      { status: 500 }
    );
  }
}

// Simple in-memory cache (in production, use Redis or similar)
const cache = new Map();

function getCachedResponse(key: string) {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCachedResponse(key: string, data: any, ttlSeconds: number) {
  cache.set(key, {
    data,
    expires: Date.now() + (ttlSeconds * 1000)
  });
}


