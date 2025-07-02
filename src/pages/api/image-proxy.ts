import type { NextApiRequest, NextApiResponse } from 'next';
import { Buffer } from 'buffer';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Decode the URL if it's encoded
    const decodedUrl = decodeURIComponent(url);
    
    // Validate that it's an image URL from allowed domains
    const allowedDomains = [
      'libgen.is',
      'covers.openlibrary.org',
      'books.google.com',
      'images-na.ssl-images-amazon.com',
      'bookcover.longitood.com',
      'i.gr-assets.com',
      'images.gr-assets.com',
      's.gr-assets.com',
      'goodreads.com',
      'images-amazon.com',
      'ssl-images-amazon.com',
      'm.media-amazon.com',
      'images.amazon.com'
    ];
    
    const urlObj = new URL(decodedUrl);
    const isAllowedDomain = allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );
    
    if (!isAllowedDomain) {
      console.warn(`Domain not allowed: ${urlObj.hostname} for URL: ${decodedUrl}`);
      return res.status(403).json({ error: `Domain not allowed: ${urlObj.hostname}` });
    }    // Fetch the image with proper headers to bypass referer blocking
    const imageResponse = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        // Don't send referer header to bypass referer blocking
      },
      cache: 'no-cache',
    });

    if (!imageResponse.ok) {
      return res.status(imageResponse.status).json({ 
        error: `Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}` 
      });
    }

    const contentType = imageResponse.headers.get('content-type');
    
    // Verify it's actually an image
    if (!contentType?.startsWith('image/')) {
      return res.status(400).json({ error: 'URL does not point to an image' });
    }

    // Get the image buffer
    const buffer = await imageResponse.arrayBuffer();
    
    // Set appropriate cache headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800'); // Cache for 1 day
    res.setHeader('Content-Length', buffer.byteLength);
    
    // Send the image
    res.status(200).send(Buffer.from(buffer));

  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
}
