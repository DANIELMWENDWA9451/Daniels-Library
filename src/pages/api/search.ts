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
  tags?: string; // Optional tags property for future support
}

export interface SearchResponse {
  books: LibGenBook[];
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
    count = 10, 
    sort_by = 'def', 
    search_in = 'def', 
    offset = 0,
    reverse = false,
    multi_sort = [] // New parameter for multiple sorting criteria
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
    
    const options = {
      mirror,
      query: trimmedQuery,
      count: Math.min(count, 100), // Allow up to 100 results
      offset,
      sort_by,
      search_in,
      reverse: Boolean(reverse), // Ensure it's a boolean
    };

    // Check cache first
    const cacheKey = getCacheKey(trimmedQuery, options);
    const cachedResult = getFromCache(cacheKey);
    
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }

    let books = [];
    let searchError = null;
    
    try {
      // Increase timeout for libgen.search to 10 seconds
      const searchPromise = libgen.search(options);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Search timed out')), 10000));
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
      console.log('libgen.search error for query "' + trimmedQuery + '":', e);
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
      
      return {
        id: book.id || '',
        title: book.title || 'Unknown Title',
        author: book.author || 'Unknown Author',
        year: book.year || '',
        pages: book.pages || '',
        language: book.language || '',
        filesize: book.filesize || '',
        extension: book.extension || '',
        md5: md5,
        publisher: book.publisher || '',
        series: book.series || '',
        identifier: identifier,
        isbn: isbn,
        coverurl: coverUrl,
        rawCoverUrl: book.coverurl || '',
        tags: book.tags || '',
      };
    });

    // Apply multi-criteria sorting
    let finalBooks = transformedBooks;
    
    // If multi_sort is provided and has criteria, use it; otherwise use single sort
    const sortCriteria = Array.isArray(multi_sort) && multi_sort.length > 0 
      ? multi_sort 
      : [{ field: sort_by, reverse }];
    
    if (sortCriteria.length > 0 && sortCriteria[0].field !== 'def') {
      finalBooks = transformedBooks.sort((a: any, b: any) => {
        for (const criterion of sortCriteria) {
          const { field, reverse: criterionReverse = false } = criterion;
          let result = 0;
          
          switch (field) {
            case 'year':
              const currentYear = new Date().getFullYear();
              const yearA = parseInt(a.year) || 0;
              const yearB = parseInt(b.year) || 0;
              
              if (criterionReverse) {
                // Latest First - prioritize current year
                if (yearA === currentYear && yearB !== currentYear) result = -1;
                else if (yearB === currentYear && yearA !== currentYear) result = 1;
                else result = yearB - yearA;
              } else {
                result = yearA - yearB;
              }
              break;
              
            case 'title':
              result = a.title.localeCompare(b.title);
              if (criterionReverse) result = -result;
              break;
              
            case 'author':
              result = a.author.localeCompare(b.author);
              if (criterionReverse) result = -result;
              break;
              
            case 'publisher':
              result = a.publisher.localeCompare(b.publisher);
              if (criterionReverse) result = -result;
              break;
              
            case 'pages':
              const pagesA = parseInt(a.pages) || 0;
              const pagesB = parseInt(b.pages) || 0;
              result = pagesA - pagesB;
              if (criterionReverse) result = -result;
              break;
              
            case 'language':
              result = a.language.localeCompare(b.language);
              if (criterionReverse) result = -result;
              break;
              
            case 'filesize':
              const sizeA = parseInt(a.filesize) || 0;
              const sizeB = parseInt(b.filesize) || 0;
              result = sizeA - sizeB;
              if (criterionReverse) result = -result;
              break;
              
            case 'extension':
              // Advanced file type sorting with categories
              const getFileTypeCategory = (ext: string) => {
                const extension = ext.toLowerCase();
                if (['pdf'].includes(extension)) return 1; // PDF first
                if (['epub', 'mobi', 'azw', 'azw3'].includes(extension)) return 2; // E-book formats
                if (['djvu', 'djv'].includes(extension)) return 3; // DjVu
                if (['doc', 'docx', 'rtf', 'odt'].includes(extension)) return 4; // Word processors
                if (['txt', 'md', 'html', 'htm'].includes(extension)) return 5; // Text formats
                if (['chm', 'lit'].includes(extension)) return 6; // Help/compiled formats
                if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 7; // Archives
                return 8; // Other formats
              };
              
              const categoryA = getFileTypeCategory(a.extension);
              const categoryB = getFileTypeCategory(b.extension);
              
              if (categoryA !== categoryB) {
                result = categoryA - categoryB;
              } else {
                // Within same category, sort alphabetically
                result = a.extension.localeCompare(b.extension);
              }
              
              if (criterionReverse) result = -result;
              break;
              
            default:
              result = 0;
          }
          
          // If this criterion produces a non-zero result, return it
          if (result !== 0) {
            return result;
          }
          
          // If result is 0, continue to next criterion
        }
        
        return 0; // All criteria resulted in equality
      });
    }

    const result = { books: finalBooks };
    
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