import type { NextApiRequest, NextApiResponse } from 'next';

const libgen = require('libgen');

// Simple in-memory cache for search results
const searchCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function getCacheKey(query: string, options: any): string {
  return Buffer.from(JSON.stringify({ query, ...options })).toString('base64');
}

function getFromCache(key: string): any | null {
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  if (cached) {
    searchCache.delete(key); // Remove expired cache
  }
  return null;
}

function setCache(key: string, data: any): void {
  // Limit cache size to prevent memory issues
  if (searchCache.size > 100) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }
  searchCache.set(key, { data, timestamp: Date.now() });
}

export interface LibGenBook {
  id: string;
  title: string;
  author: string;
  year: string;
  pages: string;
  language: string;
  filesize: string;
  extension: string;
  md5: string;
  publisher: string;
  series: string;
  identifier: string;
  isbn: string;
  coverurl: string;
  rawCoverUrl?: string;
  tags?: string;
  topic?: string;
  volumeinfo?: string;
  periodical?: string;
  city?: string;
  edition?: string;
  commentary?: string;
  dpi?: string;
  color?: string;
  cleaned?: string;
  orientation?: string;
  paginated?: string;
  scanned?: string;
  bookmarked?: string;
  searchable?: string;
  filesize_bytes?: number;
}

export interface SearchResponse {
  books: LibGenBook[];
  totalResults?: number;
  currentPage?: number;
  totalPages?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ books: [], error: 'Method not allowed' });
  }

  const { 
    query, 
    count = 25, 
    sort_by = 'def', 
    search_in = 'def', 
    offset = 0,
    reverse = false,
    topic = '',
    year_from = '',
    year_to = '',
    language = '',
    extension = '',
    phrase = 1, // 1 = no mask, 0 = with mask
    view = 'simple' // simple or detailed
  } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ books: [], error: 'Query is required' });
  }

  // Warning for very short queries but don't block them
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return res.status(400).json({ books: [], error: 'Search query must be at least 2 characters long' });
  }

  // Set cache headers for better performance
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600'); // 5 min cache, 10 min stale

  try {
    // Use a configurable mirror, with a fallback to libgen.is
    const mirror = process.env.LIBGEN_MIRROR || 'http://libgen.is';
    
    // Build search query with topic filtering
    let searchQuery = trimmedQuery;
    
    // If topic is specified, add it to the search
    if (topic) {
      // Topic search uses topicid format like in the HTML
      if (topic.startsWith('topicid')) {
        searchQuery = topic;
        // Override search_in to topic when searching by topic
        search_in = 'topic';
      } else {
        // Convert topic name to search term
        searchQuery = `${trimmedQuery} ${topic}`;
      }
    }

    // Add year filtering to query if specified
    if (year_from || year_to) {
      if (year_from && year_to) {
        searchQuery += ` year:${year_from}-${year_to}`;
      } else if (year_from) {
        searchQuery += ` year:${year_from}-`;
      } else if (year_to) {
        searchQuery += ` year:-${year_to}`;
      }
    }

    // Add language filter
    if (language) {
      searchQuery += ` language:${language}`;
    }

    // Add extension filter
    if (extension) {
      searchQuery += ` extension:${extension}`;
    }
    
    const options = {
      mirror,
      query: searchQuery,
      count: Math.min(count, 100), // Allow up to 100 results
      offset,
      sort_by,
      search_in,
      reverse: Boolean(reverse), // Ensure it's a boolean
    };

    // Check cache first
    const cacheKey = getCacheKey(searchQuery, options);
    const cachedResult = getFromCache(cacheKey);
    
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }

    let books = [];
    let searchError = null;
    
    try {
      // Increase timeout for libgen.search to 15 seconds
      const searchPromise = libgen.search(options);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Search timed out')), 15000));
      const results = await Promise.race([searchPromise, timeoutPromise]);
      
      // The libgen library sometimes returns a single object with a count of 0
      // or throws an error when no results are found. We need to handle both cases.
      if (Array.isArray(results)) {
        books = results;
      } else if (results && typeof results === 'object' && results.count === 0) {
        books = [];
      } else if (!results) {
        books = [];
      }
    } catch (e) {
      // If libgen throws (e.g. "no results" error or query too short), we'll handle it gracefully
      console.log('libgen.search error for query "' + searchQuery + '":', e);
      searchError = e;
      books = [];
      
      // For very short queries, provide a more helpful error message
      if (trimmedQuery.length <= 2) {
        return res.status(200).json({ 
          books: [], 
          error: `No results found for "${trimmedQuery}". Short search terms may not return results. Try a longer, more specific search term.` 
        });
      }
    }
    
    // Transform the data to ensure consistent structure and add cover URLs
    const transformedBooks = books.map((book: any) => {
      const md5 = book.md5 || '';
      const identifier = book.identifier || '';
      
      // Extract ISBN from identifier field for cover lookup
      let isbn = '';
      if (identifier) {
        // Look for ISBN patterns in the identifier field
        const isbnMatch = identifier.match(/(?:ISBN[:\s]?)?(?:97[89][\d\s-]{10,17}|[\d\s-]{9,13}[X\d])/i);
        if (isbnMatch) {
          isbn = isbnMatch[0].replace(/[^\dX]/gi, ''); // Clean ISBN
        }
      }
      
      // Use the new book cover API endpoint for better cover images
      const params = new URLSearchParams();
      if (isbn) params.append('isbn', isbn);
      if (book.title) params.append('title', book.title);
      if (book.author) params.append('author', book.author);
      if (book.coverurl) params.append('rawCoverUrl', book.coverurl); // Pass the raw coverurl
      
      const coverUrl = `/api/book-cover?${params.toString()}`;
      
      // Convert filesize to bytes for better sorting
      let filesizeBytes = 0;
      if (book.filesize) {
        const sizeStr = book.filesize.toLowerCase();
        const sizeNum = parseFloat(sizeStr);
        if (sizeStr.includes('kb')) {
          filesizeBytes = sizeNum * 1024;
        } else if (sizeStr.includes('mb')) {
          filesizeBytes = sizeNum * 1024 * 1024;
        } else if (sizeStr.includes('gb')) {
          filesizeBytes = sizeNum * 1024 * 1024 * 1024;
        } else {
          filesizeBytes = sizeNum;
        }
      }
      
      return {
        id: book.id || '',
        title: book.title || 'Unknown Title',
        author: book.author || 'Unknown Author',
        year: book.year || '',
        pages: book.pages || '',
        language: book.language || '',
        filesize: book.filesize || '',
        filesize_bytes: filesizeBytes,
        extension: book.extension || '',
        md5: md5,
        publisher: book.publisher || '',
        series: book.series || '',
        identifier: identifier,
        isbn: isbn,
        coverurl: coverUrl,
        rawCoverUrl: book.coverurl || '',
        tags: book.tags || '',
        topic: book.topic || '',
        volumeinfo: book.volumeinfo || '',
        periodical: book.periodical || '',
        city: book.city || '',
        edition: book.edition || '',
        commentary: book.commentary || '',
        dpi: book.dpi || '',
        color: book.color || '',
        cleaned: book.cleaned || '',
        orientation: book.orientation || '',
        paginated: book.paginated || '',
        scanned: book.scanned || '',
        bookmarked: book.bookmarked || '',
        searchable: book.searchable || '',
      };
    });

    // Calculate pagination info
    const totalResults = transformedBooks.length;
    const currentPage = Math.floor(offset / count) + 1;
    const totalPages = Math.ceil(totalResults / count);

    const result = { 
      books: transformedBooks,
      totalResults,
      currentPage,
      totalPages
    };
    
    // Cache the result
    setCache(cacheKey, result);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('LibGen search error:', error);
    res.status(500).json({ 
      books: [], 
      error: 'Failed to search books. Please try again later.' 
    });
  }
}