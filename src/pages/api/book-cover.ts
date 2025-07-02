import type { NextApiRequest, NextApiResponse } from 'next';

export interface BookCoverResponse {
  coverUrl?: string;
  error?: string;
  source?: string;
}

// Helper function to create a proxied URL
function createProxiedUrl(originalUrl: string, req: NextApiRequest): string {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  
  return `${baseUrl}/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
}

// Helper function to check if an image URL is valid with enhanced validation
async function checkImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Increased timeout for reliability
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    // Check if it's an image and has reasonable size (not a placeholder)
    const isValidImage = response.ok && 
                        contentType?.startsWith('image/') === true &&
                        (!contentLength || parseInt(contentLength) > 1000); // At least 1KB
    
    return isValidImage;
  } catch {
    return false;
  }
}

// Helper function to fetch with timeout and retry
async function fetchWithTimeout(url: string, timeoutMs: number = 8000, retries: number = 1): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}

// Helper function to clean ISBN
function cleanIsbn(isbn: string): string {
  return isbn.replace(/[^0-9X]/g, '');
}

// Helper function to clean title for search
function cleanTitle(title: string): string {
  return title.replace(/[^\w\s]/g, '').trim();
}

// Helper function to extract main title (remove subtitle)
function extractMainTitle(title: string): string {
  return title.split(':')[0].split('(')[0].trim();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BookCoverResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { isbn, title, author, rawCoverUrl } = req.query;

  // Ensure query parameters are strings
  const isbnStr = Array.isArray(isbn) ? isbn[0] : isbn;
  const titleStr = Array.isArray(title) ? title[0] : title;
  const authorStr = Array.isArray(author) ? author[0] : author;
  const rawCoverUrlStr = Array.isArray(rawCoverUrl) ? rawCoverUrl[0] : rawCoverUrl;

  if (!isbnStr && !titleStr && !rawCoverUrlStr) {
    return res.status(400).json({ error: 'ISBN or title is required' });
  }

  // Set cache headers for better performance
  res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=604800'); // 7 days cache, 7 days stale

  try {
    let coverUrl: string | undefined;
    let source: string | undefined;

    // LIBGEN-FIRST STRATEGY - Multiple LibGen attempts before anything else
    const coverSources = [
      // Method 1: Direct LibGen Cover URL from rawCoverUrl
      async () => {
        if (!rawCoverUrlStr) return null;
        
        const lastDotIndex = rawCoverUrlStr.lastIndexOf('.');
        const baseUrl = lastDotIndex !== -1 ? rawCoverUrlStr.substring(0, lastDotIndex) : rawCoverUrlStr;
        
        const potentialUrls = [
          `https://libgen.is/covers/${baseUrl}-g.jpg`,
          `https://libgen.is/covers/${baseUrl}-d.jpg`,
          `https://libgen.is/covers/${rawCoverUrlStr}`
        ];

        for (const url of potentialUrls) {
          if (await checkImageUrl(url)) {
            return { url, source: `LibGen Direct` };
          }
        }
        return null;
      },

      // Method 2: LibGen ISBN-based patterns (multiple strategies)
      async () => {
        if (!isbnStr) return null;
        const cleanedIsbn = cleanIsbn(isbnStr);
        if (cleanedIsbn.length >= 10) {
          // Try various LibGen URL patterns
          const patterns = [
            // Standard patterns
            `https://libgen.is/covers/${cleanedIsbn}-g.jpg`,
            `https://libgen.is/covers/${cleanedIsbn}-d.jpg`,
            // Try with ISBN-13 if we have ISBN-10
            ...(cleanedIsbn.length === 10 ? [
              `https://libgen.is/covers/978${cleanedIsbn}-g.jpg`,
              `https://libgen.is/covers/978${cleanedIsbn}-d.jpg`,
            ] : []),
            // Try with directory structure patterns (common in LibGen)
            `https://libgen.is/covers/${cleanedIsbn.slice(0, 3)}000/${cleanedIsbn}-g.jpg`,
            `https://libgen.is/covers/${cleanedIsbn.slice(0, 3)}000/${cleanedIsbn}-d.jpg`,
            // Try with different directory patterns
            `https://libgen.is/covers/${cleanedIsbn.slice(-3)}000/${cleanedIsbn}-g.jpg`,
            `https://libgen.is/covers/${cleanedIsbn.slice(-3)}000/${cleanedIsbn}-d.jpg`,
          ];
          
          for (const url of patterns) {
            if (await checkImageUrl(url)) {
              return { url, source: `LibGen ISBN Pattern` };
            }
          }
        }
        return null;
      },

      // Method 3: LibGen with hash-based patterns (simulate common MD5 patterns)
      async () => {
        if (!isbnStr && !titleStr) return null;
        
        // Generate potential hash patterns based on ISBN or title
        const searchString = isbnStr ? cleanIsbn(isbnStr) : cleanTitle(titleStr).toLowerCase();
        
        // Try common LibGen directory patterns with simulated hashes
        const hashPatterns = [
          '880000', '881000', '882000', '883000', '884000', '885000',
          '2944000', '2945000', '2946000', '2947000', '2948000',
          '1000000', '1001000', '1002000', '1003000', '1004000',
          '3000000', '3001000', '3002000', '3003000', '3004000'
        ];
        
        for (const pattern of hashPatterns) {
          const urls = [
            `https://libgen.is/covers/${pattern}/${searchString}-g.jpg`,
            `https://libgen.is/covers/${pattern}/${searchString}-d.jpg`,
            // Try with some random suffixes that are common in LibGen
            `https://libgen.is/covers/${pattern}/${searchString}abcd-g.jpg`,
            `https://libgen.is/covers/${pattern}/${searchString}abcd-d.jpg`,
          ];
          
          for (const url of urls) {
            if (await checkImageUrl(url)) {
              return { url, source: `LibGen Hash Pattern` };
            }
          }
        }
        return null;
      },

      // Method 4: LibGen title-based search patterns
      async () => {
        if (!titleStr) return null;
        
        const cleanedTitle = cleanTitle(extractMainTitle(titleStr)).toLowerCase().replace(/\s+/g, '');
        
        // Try common LibGen patterns with title
        const titlePatterns = [
          `https://libgen.is/covers/${cleanedTitle}-g.jpg`,
          `https://libgen.is/covers/${cleanedTitle}-d.jpg`,
          `https://libgen.is/covers/${cleanedTitle.slice(0, 20)}-g.jpg`,
          `https://libgen.is/covers/${cleanedTitle.slice(0, 20)}-d.jpg`,
        ];
        
        for (const url of titlePatterns) {
          if (await checkImageUrl(url)) {
            return { url, source: `LibGen Title Pattern` };
          }
        }
        return null;
      },

      // Method 5: Open Library ISBN Cover API (only after all LibGen attempts)
      async () => {
        if (!isbnStr) return null;
        const cleanedIsbn = cleanIsbn(isbnStr);
        if (cleanedIsbn.length >= 10) {
          const sizes = ['M', 'L']; // Try smaller size first for bandwidth
          for (const size of sizes) {
            const url = `https://covers.openlibrary.org/b/isbn/${cleanedIsbn}-${size}.jpg`;
            if (await checkImageUrl(url)) {
              return { url, source: `Open Library ISBN ${size}` };
            }
          }
        }
        return null;
      },

      // Method 6: Google Books API
      async () => {
        if (!isbnStr && !titleStr) return null;
        try {
          let googleApiUrl = 'https://www.googleapis.com/books/v1/volumes?q=';
          const cleanedIsbn = isbnStr ? cleanIsbn(isbnStr) : '';

          if (cleanedIsbn.length >= 10) {
            googleApiUrl += `isbn:${cleanedIsbn}`;
          } else if (titleStr) {
            let query = `intitle:${encodeURIComponent(extractMainTitle(titleStr))}`;
            if (authorStr && authorStr !== 'Unknown Author') {
              query += `+inauthor:${encodeURIComponent(authorStr)}`;
            }
            googleApiUrl += query;
          } else {
            return null;
          }

          const response = await fetchWithTimeout(googleApiUrl, 4000, 0); // Lower timeout, no retry
          if (response.ok) {
            const data = await response.json();
            if (data.items && data.items.length > 0) {
              const imageLinks = data.items[0].volumeInfo.imageLinks;
              if (imageLinks) {
                const potentialCovers = [
                  imageLinks.smallThumbnail,
                  imageLinks.thumbnail,
                  imageLinks.small,
                  imageLinks.medium,
                  imageLinks.large,
                  imageLinks.extraLarge,
                ];
                for (const cover of potentialCovers) {
                  if (cover) {
                    const secureCoverUrl = cover.replace('http://', 'https://');
                    if (await checkImageUrl(secureCoverUrl)) {
                      return { url: secureCoverUrl, source: 'Google Books' };
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.log('Google Books search failed:', error);
        }
        return null;
      },

      // Method 7: BookCover.longitood.com (Goodreads source)
      async () => {
        try {
          let bookCoverLookupUrl = '';
          const cleanedIsbn = isbnStr ? cleanIsbn(isbnStr) : '';

          if (cleanedIsbn.length >= 10) {
            bookCoverLookupUrl = `https://bookcover.longitood.com/bookcover/${cleanedIsbn}`;
          } else if (titleStr && authorStr && authorStr !== 'Unknown Author') {
            bookCoverLookupUrl = `https://bookcover.longitood.com/bookcover?book_title=${encodeURIComponent(extractMainTitle(titleStr))}&author_name=${encodeURIComponent(authorStr)}`;
          }

          if (bookCoverLookupUrl) {
            const response = await fetchWithTimeout(bookCoverLookupUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.url && await checkImageUrl(data.url)) {
                    return { url: data.url, source: 'Longitood/Goodreads' };
                }
            }
          }
        } catch (error) {
          console.log('Longitood search failed:', error);
        }
        return null;
      },
      
      // Method 8: Open Library Search API (Title-based fallback)
      async () => {
        if (!titleStr) return null;
        try {
          const mainTitle = extractMainTitle(titleStr);
          let searchQuery = cleanTitle(mainTitle);
          if (authorStr && authorStr !== 'Unknown Author') {
            searchQuery += ` ${authorStr}`;
          }
          
          const openLibrarySearchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=5`;
          const searchResponse = await fetchWithTimeout(openLibrarySearchUrl);
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();

            if (searchData.docs && searchData.docs.length > 0) {
              for (const book of searchData.docs) {
                if (book.cover_i) {
                  const sizes = ['L', 'M'];
                  for (const size of sizes) {
                    const candidateUrl = `https://covers.openlibrary.org/b/id/${book.cover_i}-${size}.jpg`;
                    if (await checkImageUrl(candidateUrl)) {
                      return { url: candidateUrl, source: `Open Library Search ${size}` };
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.log('Open Library search failed:', error);
        }
        return null;
      },
    ];

    // Try all sources in order - LibGen methods first!
    for (const [index, sourceFunction] of coverSources.entries()) {
      try {
        const result = await sourceFunction();
        if (result) {
          coverUrl = result.url;
          source = result.source;
          break; // Found a valid cover, stop searching
        }
      } catch (error) {
        console.log(`Cover source ${index + 1} failed:`, error);
        continue; // Try next source
      }
    }

    if (coverUrl) {
      // Create proxied URL to avoid CORS issues
      const proxiedUrl = createProxiedUrl(coverUrl, req);
      return res.status(200).json({ 
        coverUrl: proxiedUrl, 
        source: source || 'Unknown'
      });
    } else {
      return res.status(404).json({ 
        error: 'No cover image found',
        source: 'None'
      });
    }

  } catch (error) {
    console.error('Book cover API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error while fetching cover'
    });
  }
}