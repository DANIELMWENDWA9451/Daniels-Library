import React, { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { coverCache, generateCoverKey } from '@/lib/cache';
import type { BookCoverResponse } from '@/pages/api/book-cover';
import { Book } from 'lucide-react';

interface BookCoverProps {
  isbn?: string;
  title: string;
  author?: string;
  extension?: string;
  rawCoverUrl?: string;
  className?: string;
}

export function BookCover({ isbn, title, author, extension, rawCoverUrl, className = "" }: BookCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchCover = async () => {
      if (!isbn && !title && !rawCoverUrl) {
        if (isMounted) {
          setLoading(false);
          setError(true);
        }
        return;
      }

      const cacheKey = generateCoverKey(isbn, title, author, rawCoverUrl);
      const cachedCover = coverCache.get(cacheKey);
      
      if (cachedCover) {
        if (isMounted) {
          setCoverUrl(cachedCover.coverUrl || null);
          setSource(cachedCover.source || null);
          setError(!cachedCover.coverUrl);
          setLoading(false);
        }
        return;
      }

      try {
        const params = new URLSearchParams();
        if (isbn) params.append('isbn', isbn);
        if (title) params.append('title', title);
        if (author) params.append('author', author);
        if (rawCoverUrl) params.append('rawCoverUrl', rawCoverUrl);

        const response = await fetch(`/api/book-cover?${params.toString()}`);
        const data: BookCoverResponse = await response.json();

        // Cache successful results for longer, failed results for shorter time
        const cacheTime = data.coverUrl ? 2 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000; // 48h vs 1h
        coverCache.set(cacheKey, data, cacheTime);

        if (isMounted) {
          if (data.coverUrl) {
            setCoverUrl(data.coverUrl);
            setSource(data.source || null);
            setError(false);
          } else {
            console.log('No cover found for book:', { title, author, isbn, error: data.error });
            setError(true);
          }
        }
      } catch (err) {
        console.error('Cover fetch error:', err);
        if (isMounted) {
          setError(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCover();
    return () => { isMounted = false; };
  }, [isbn, title, author, rawCoverUrl]);

  useEffect(() => {
    if (coverUrl) {
      const img = new Image();
      img.src = coverUrl;
      img.onload = () => setIsImageLoaded(true);
      img.onerror = () => {
        setError(true);
        const cacheKey = generateCoverKey(isbn, title, author, rawCoverUrl);
        coverCache.delete(cacheKey);
      };
    }
  }, [coverUrl, isbn, title, author, rawCoverUrl]);

  const renderContent = () => {
    if (loading || (coverUrl && !isImageLoaded)) {
      return (
        <div className="w-full h-full shimmer-bg" />
      );
    }

    if (error || !coverUrl) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
          <div className="text-center p-4 text-muted-foreground">
            <Book className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-medium">No Cover</p>
          </div>
        </div>
      );
    }

    return (
      <img
        src={coverUrl}
        alt={`Cover of ${title}`}
        loading="lazy"
        className={`w-full h-full object-contain bg-muted group-hover:scale-105 transition-transform duration-300 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ transition: 'opacity 0.5s ease-in-out, transform 0.3s ease-in-out' }}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-20 h-28 sm:w-24 sm:h-32 md:w-28 md:h-40 bg-muted overflow-hidden rounded-xl shadow-lg border-2 border-slate-700 group transition-transform duration-300 hover:scale-105 ${className}`}
      style={{ aspectRatio: '3/4', minWidth: '5rem', minHeight: '7rem', background: 'linear-gradient(135deg, #232946 60%, #1a1a2e 100%)' }}
    >
      {renderContent()}
      {extension && (
        <Badge variant="secondary" className="absolute top-2 right-2 bg-black/70 text-white border-0 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-medium shadow-lg">
          {extension.toUpperCase()}
        </Badge>
      )}
      {source && isImageLoaded && (
        <Badge variant="outline" className="absolute bottom-2 left-2 bg-black/60 text-white border-white/20 backdrop-blur-sm rounded-md px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300" title={`Cover from ${source}`}>
          {source}
        </Badge>
      )}
    </div>
  );
}