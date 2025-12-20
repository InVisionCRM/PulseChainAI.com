export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const count = searchParams.get('count') || '3';

    if (!username) {
      return Response.json(
        { error: 'Username parameter required' },
        { status: 400 }
      );
    }

    // Check for rate limiting - return cached response if available
    const cacheKey = `mentions-${username}-${count}`;
    const cachedResponse = getCachedResponse(cacheKey);

    if (cachedResponse) {
      return Response.json(cachedResponse);
    }

    // First get user ID
    const userResponse = await fetch(`https://api.twitter.com/2/users/by/username/${username}`, {
      headers: {
        'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userResponse.ok) {
      console.error('Twitter API user lookup error:', userResponse.status, userResponse.statusText);
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

    // Search for tweets mentioning this user
    // Note: Twitter API v2 search requires premium API for comprehensive results
    // This is a basic implementation - in production you might want to use Twitter Premium API
    const searchResponse = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=(${username})&max_results=${count}&tweet.fields=created_at,public_metrics,text,author_id,entities&user.fields=username,name,profile_image_url&expansions=author_id`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!searchResponse.ok) {
      console.error('Twitter API search error:', searchResponse.status, searchResponse.statusText);
      if (searchResponse.status === 429) {
        return Response.json(
          { error: 'Rate limited' },
          { status: 429 }
        );
      }
      if (searchResponse.status >= 500) {
        return Response.json(
          { error: 'Twitter API error' },
          { status: searchResponse.status }
        );
      }
      return Response.json(
        { error: 'Failed to search tweets', status: searchResponse.status },
        { status: searchResponse.status }
      );
    }

    const searchData = await searchResponse.json();

    // Cache the response
    setCachedResponse(cacheKey, searchData, 300); // Cache for 5 minutes

    return Response.json(searchData, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'CDN-Cache-Control': 'max-age=300',
        'Vercel-CDN-Cache-Control': 'max-age=300',
      },
    });
  } catch (error) {
    console.error('Mentions API route error:', error);
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
