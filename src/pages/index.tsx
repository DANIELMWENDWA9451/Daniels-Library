import React, { useState, useCallback, useEffect, useRef } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Book, Filter, Loader2, Sun, Moon, ChevronLeft, ChevronRight, Plus, X, Settings, Menu, Download, Star, Calendar, FileText, Users, Globe, HardDrive, Zap, TrendingUp, Check, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription, SheetHeader } from "@/components/ui/sheet";
import { DownloadButton } from "@/components/DownloadButton";
import { BookCover } from "@/components/BookCover";
import { cn } from "@/lib/utils";
import { searchCache, generateSearchKey } from "@/lib/cache";
// The type is imported from search.ts, so we need to ensure it's updated there first.
// No change needed here for the type definition itself, as it's imported.
import type { LibGenBook, SearchResponse } from "./api/search";
import { useRouter } from 'next/router';
import Header from "@/components/Header";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" }
  }
};

const bookCardVariants = {
  initial: { opacity: 0, y: 15 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" }
  }
};

// 1. Add topics data (hardcoded for now)
const TOPICS = [
  {
    label: 'Technology',
    children: [
      { label: 'Aerospace Equipment' },
      { label: 'Automation' },
      { label: 'Communication: Telecommunications' },
      { label: 'Electronics: Robotics' },
      { label: 'Mechanical Engineering' },
      { label: 'Nanotechnology' },
      { label: 'Publishing' },
      // ... add more as needed
    ],
  },
  {
    label: 'Art',
    children: [
      { label: 'Cinema' },
      { label: 'Design: Architecture' },
      { label: 'Music' },
      // ...
    ],
  },
  {
    label: 'Biology',
    children: [
      { label: 'Anthropology' },
      { label: 'Biostatistics' },
      { label: 'Genetics' },
      // ...
    ],
  },
  // ... more top-level topics
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [books, setBooks] = useState<LibGenBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchIn, setSearchIn] = useState("def");
  const [sortBy, setSortBy] = useState("def");
  const [reverse, setReverse] = useState(false);
  const [multiSort, setMultiSort] = useState<Array<{field: string, reverse: boolean}>>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(20);
  const [totalResults, setTotalResults] = useState(0);
  const [actualResultsCount, setActualResultsCount] = useState(0);
  const [fileTypeFilter, setFileTypeFilter] = useState<string[]>([]);
  const [withCoverOnly, setWithCoverOnly] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const sparkleButtonRef = useRef<HTMLButtonElement>(null);
  const [authorFilter, setAuthorFilter] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("");
  const [publisherFilter, setPublisherFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [isbnFilter, setIsbnFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [tagsFilter, setTagsFilter] = useState("");
  const [sortField, setSortField] = useState<string>('def');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [jumpPage, setJumpPage] = useState<string>('');
  const [detailedView, setDetailedView] = useState(true);
  const [selectedBook, setSelectedBook] = useState<LibGenBook | null>(null);
  const [pendingQuery, setPendingQuery] = useState(searchQuery);
  const [pendingAuthor, setPendingAuthor] = useState(authorFilter);
  const [pendingSeries, setPendingSeries] = useState(seriesFilter);
  const [pendingPublisher, setPendingPublisher] = useState(publisherFilter);
  const [pendingYear, setPendingYear] = useState(yearFilter);
  const [pendingIsbn, setPendingIsbn] = useState(isbnFilter);
  const [pendingLanguage, setPendingLanguage] = useState(languageFilter);
  const [pendingFileType, setPendingFileType] = useState(fileTypeFilter[0] || '');
  const [pendingTags, setPendingTags] = useState(tagsFilter);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [subTopics, setSubTopics] = useState<string[]>([]);
  const router = useRouter();

  const handleSparkle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--sparkle-x', `${x}px`);
    e.currentTarget.style.setProperty('--sparkle-y', `${y}px`);
  };

  const searchBooks = useCallback(async (page = 1, newQuery?: string, options?: { searchIn?: string }) => {
    const queryToUse = newQuery || searchQuery;
    const searchInToUse = options?.searchIn || searchIn;
    
    if (!queryToUse.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a book title, author, or keyword to search.",
        variant: "destructive",
      });
      return;
    }

    // Check for very short queries and warn user
    if (queryToUse.trim().length < 2) {
      toast({
        title: "Search term too short",
        description: "Please enter at least 2 characters for better search results.",
        variant: "destructive",
      });
      return;
    }

    // Warn for short queries but allow them
    if (queryToUse.trim().length <= 2) {
      toast({
        title: "Short search term",
        description: "Short terms like 'CT' may return limited results. Try being more specific.",
        variant: "default",
      });
    }

    setLoading(true);
    setHasSearched(true);
    setIsCached(false);

    try {
      const offset = (page - 1) * resultsPerPage;
      const searchOptions = {
        query: queryToUse,
        count: resultsPerPage,
        offset,
        search_in: searchInToUse,
        sort_by: sortBy,
        reverse: reverse,
        multi_sort: multiSort,
      };

      const cacheKey = generateSearchKey(queryToUse, searchOptions);
      const cachedResult = searchCache.get(cacheKey);
      
      if (cachedResult) {
        setBooks(cachedResult.books);
        setActualResultsCount(cachedResult.books.length);
        setCurrentPage(page);
        setIsCached(true);
        
        if (cachedResult.books.length === resultsPerPage) {
          setTotalResults(page * resultsPerPage + 1);
        } else {
          setTotalResults((page - 1) * resultsPerPage + cachedResult.books.length);
        }
        
        setLoading(false);
        return;
      }

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchOptions),
      });

      const data: SearchResponse = await response.json();

      if (data.error) {
        toast({
          title: "Search failed",
          description: data.error,
          variant: "destructive",
        });
        setBooks([]);
        setTotalResults(0);
        setActualResultsCount(0);
      } else {
        // If no results, cache for only 3 seconds to allow quick refresh after DB update
        if (data.books.length === 0) {
          searchCache.set(cacheKey, data, 3 * 1000); // 30 seconds
        } else {
          searchCache.set(cacheKey, data);
        }
        setBooks(data.books);
        setActualResultsCount(data.books.length);
        setCurrentPage(page);
        
        if (data.books.length === resultsPerPage) {
          setTotalResults(page * resultsPerPage + 1);
        } else {
          setTotalResults((page - 1) * resultsPerPage + data.books.length);
        }
        
        if (data.books.length === 0) {
          toast({
            title: "No results found",
            description: queryToUse.trim().length <= 2 
              ? `No results for \"${queryToUse}\". Short terms may have limited results. Try a more specific search.`
              : "Try adjusting your search terms or filters.",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Search failed",
        description: "An error occurred while searching. Please try again.",
        variant: "destructive",
      });
      setBooks([]);
      setTotalResults(0);
      setActualResultsCount(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, searchIn, sortBy, reverse, resultsPerPage, multiSort, toast]);

  const filteredBooks = React.useMemo(() => {
    let filtered: LibGenBook[] = books;
    if (fileTypeFilter.length > 0) {
      filtered = filtered.filter((book: LibGenBook) => fileTypeFilter.includes(book.extension?.toLowerCase?.() || ""));
    }
    if (withCoverOnly) {
      filtered = filtered.filter((book: LibGenBook) => book.rawCoverUrl && book.rawCoverUrl.length > 0);
    }
    if (authorFilter.trim()) {
      filtered = filtered.filter((book: LibGenBook) => book.author && book.author.toLowerCase().includes(authorFilter.toLowerCase()));
    }
    if (seriesFilter.trim()) {
      filtered = filtered.filter((book: LibGenBook) => book.series && book.series.toLowerCase().includes(seriesFilter.toLowerCase()));
    }
    if (publisherFilter.trim()) {
      filtered = filtered.filter((book: LibGenBook) => book.publisher && book.publisher.toLowerCase().includes(publisherFilter.toLowerCase()));
    }
    if (yearFilter.trim()) {
      filtered = filtered.filter((book: LibGenBook) => book.year && book.year.includes(yearFilter));
    }
    if (isbnFilter.trim()) {
      filtered = filtered.filter((book: LibGenBook) => book.isbn && book.isbn.includes(isbnFilter));
    }
    if (languageFilter.trim()) {
      filtered = filtered.filter((book: LibGenBook) => book.language && book.language.toLowerCase().includes(languageFilter.toLowerCase()));
    }
    if (tagsFilter.trim()) {
      filtered = filtered.filter((book: LibGenBook) => book.tags && book.tags.toLowerCase().includes(tagsFilter.toLowerCase()));
    }
    return filtered;
  }, [books, fileTypeFilter, withCoverOnly, authorFilter, seriesFilter, publisherFilter, yearFilter, isbnFilter, languageFilter, tagsFilter]);

  // Sorting logic
  const sortedBooks = React.useMemo(() => {
    if (sortField === 'def') return filteredBooks;
    return [...filteredBooks].sort((a, b) => {
      let aVal = a[sortField as keyof LibGenBook] || '';
      let bVal = b[sortField as keyof LibGenBook] || '';
      if (sortField === 'year' || sortField === 'pages' || sortField === 'filesize') {
        aVal = parseInt(aVal as string) || 0;
        bVal = parseInt(bVal as string) || 0;
        return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredBooks, sortField, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedBooks.length / resultsPerPage);
  const getPageNumbers = () => {
    if (totalPages <= 10) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (currentPage > 5) pages.push('...');
    for (let i = Math.max(2, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) pages.push(i);
    if (currentPage < totalPages - 4) pages.push('...');
    pages.push(totalPages);
    return pages;
  };
  const pagedBooks = sortedBooks.slice((currentPage - 1) * resultsPerPage, currentPage * resultsPerPage);

  // Helper to get unique values for dropdowns
  const getUnique = (field: keyof LibGenBook) => Array.from(new Set(books.map(b => b[field]).filter(Boolean))).sort();

  // On mount, initialize state from URL query params
  useEffect(() => {
    const q = router.query.q as string || '';
    const author = router.query.author as string || '';
    const series = router.query.series as string || '';
    const publisher = router.query.publisher as string || '';
    const year = router.query.year as string || '';
    const isbn = router.query.isbn as string || '';
    const language = router.query.language as string || '';
    const extension = router.query.extension as string || '';
    const tags = router.query.tags as string || '';
    const perPage = router.query.perPage as string || '';
    const searchInField = router.query.searchIn as string || 'def';
    setPendingQuery(q);
    setPendingAuthor(author);
    setPendingSeries(series);
    setPendingPublisher(publisher);
    setPendingYear(year);
    setPendingIsbn(isbn);
    setPendingLanguage(language);
    setPendingFileType(extension);
    setPendingTags(tags);
    setResultsPerPage(perPage ? Number(perPage) : 25);
    setSearchIn(searchInField);
  }, [router.query]);

  // When topic changes, auto-populate filters (simulate for now)
  useEffect(() => {
    if (selectedTopic) {
      // Simulate: when a topic is chosen, auto-populate year, publisher, etc.
      setPendingYear("");
      setPendingPublisher("");
      setPendingAuthor("");
      // In a real app, fetch available years/publishers for the topic
    }
  }, [selectedTopic]);

  // Update URL with query params on search
  const applyFilters = () => {
    setSearchQuery(pendingQuery);
    setAuthorFilter(pendingAuthor);
    setSeriesFilter(pendingSeries);
    setPublisherFilter(pendingPublisher);
    setYearFilter(pendingYear);
    setIsbnFilter(pendingIsbn);
    setLanguageFilter(pendingLanguage);
    setFileTypeFilter(pendingFileType ? [pendingFileType] : []);
    setTagsFilter(pendingTags);
    setCurrentPage(1);
    router.push({
      pathname: '/',
      query: {
        q: pendingQuery,
        author: pendingAuthor,
        series: pendingSeries,
        publisher: pendingPublisher,
        year: pendingYear,
        isbn: pendingIsbn,
        language: pendingLanguage,
        extension: pendingFileType,
        tags: pendingTags,
        perPage: resultsPerPage,
        searchIn: searchIn,
      },
    }, undefined, { shallow: true });
    searchBooks(1, pendingQuery);
  };

  // 3. Fix pagination logic: update page in URL and trigger new search
  useEffect(() => {
    if (hasSearched) {
      router.push({
        pathname: '/',
        query: {
          ...router.query,
          page: currentPage,
        },
      }, undefined, { shallow: true });
      searchBooks(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // 2. Refactor FilterBar into a card box with topics dropdown
  const FilterBar = () => (
    <div className="mx-auto max-w-3xl bg-card/90 shadow-2xl border border-slate-800 rounded-2xl p-6 mb-8 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:w-1/2">
          <label className="block text-xs font-semibold mb-1">Topic</label>
          <Select value={selectedTopic} onValueChange={v => {
            setSelectedTopic(v);
            const topic = TOPICS.find(t => t.label === v);
            setSubTopics(topic?.children?.map(c => c.label) || []);
          }}>
            <SelectTrigger><SelectValue placeholder="Choose topic" /></SelectTrigger>
            <SelectContent>
              {TOPICS.map(t => (
                <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {subTopics.length > 0 && (
          <div className="w-full sm:w-1/2">
            <label className="block text-xs font-semibold mb-1">Subtopic</label>
            <Select value={pendingTags} onValueChange={v => setPendingTags(v)}>
              <SelectTrigger><SelectValue placeholder="Choose subtopic" /></SelectTrigger>
              <SelectContent>
                {subTopics.map(sub => (
                  <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1">Author</label>
          <Select value={pendingAuthor || "__all__"} onValueChange={v => setPendingAuthor(v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Author" /></SelectTrigger>
            <SelectContent><SelectItem value="__all__">All Authors</SelectItem>{getUnique('author').map(a => <SelectItem key={a} value={a as string}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Series</label>
          <Select value={pendingSeries || "__all__"} onValueChange={v => setPendingSeries(v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Series" /></SelectTrigger>
            <SelectContent><SelectItem value="__all__">All Series</SelectItem>{getUnique('series').map(s => <SelectItem key={s} value={s as string}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Publisher</label>
          <Select value={pendingPublisher || "__all__"} onValueChange={v => setPendingPublisher(v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Publisher" /></SelectTrigger>
            <SelectContent><SelectItem value="__all__">All Publishers</SelectItem>{getUnique('publisher').map(p => <SelectItem key={p} value={p as string}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Year</label>
          <Select value={pendingYear || "__all__"} onValueChange={v => setPendingYear(v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent><SelectItem value="__all__">All Years</SelectItem>{getUnique('year').map(y => <SelectItem key={y} value={y as string}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">ISBN</label>
          <Input placeholder="ISBN" value={pendingIsbn} onChange={e => setPendingIsbn(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Language</label>
          <Select value={pendingLanguage || "__all__"} onValueChange={v => setPendingLanguage(v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
            <SelectContent><SelectItem value="__all__">All Languages</SelectItem>{getUnique('language').map(l => <SelectItem key={l} value={l as string}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Extension</label>
          <Select value={pendingFileType || "__all__"} onValueChange={v => setPendingFileType(v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Extension" /></SelectTrigger>
            <SelectContent><SelectItem value="__all__">All Types</SelectItem>{getUnique('extension').map(ext => <SelectItem key={ext} value={ext as string}>{ext.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Tags</label>
          <Input placeholder="Tags" value={pendingTags} onChange={e => setPendingTags(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Results per page</label>
          <Select value={String(resultsPerPage)} onValueChange={v => { setResultsPerPage(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Per Page" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="col-span-full mt-4">
        <label className="block text-xs font-semibold mb-1">Search in fields</label>
        <div className="flex flex-wrap gap-2 mb-2">
          <label className="flex items-center gap-1"><input type="radio" name="column" value="def" checked={searchIn === 'def'} onChange={() => setSearchIn('def')} /> Default</label>
          <label className="flex items-center gap-1"><input type="radio" name="column" value="title" checked={searchIn === 'title'} onChange={() => setSearchIn('title')} /> Title</label>
          <label className="flex items-center gap-1"><input type="radio" name="column" value="author" checked={searchIn === 'author'} onChange={() => setSearchIn('author')} /> Author</label>
          <label className="flex items-center gap-1"><input type="radio" name="column" value="series" checked={searchIn === 'series'} onChange={() => setSearchIn('series')} /> Series</label>
          <label className="flex items-center gap-1"><input type="radio" name="column" value="publisher" checked={searchIn === 'publisher'} onChange={() => setSearchIn('publisher')} /> Publisher</label>
          <label className="flex items-center gap-1"><input type="radio" name="column" value="year" checked={searchIn === 'year'} onChange={() => setSearchIn('year')} /> Year</label>
          <label className="flex items-center gap-1"><input type="radio" name="column" value="identifier" checked={searchIn === 'identifier'} onChange={() => setSearchIn('identifier')} /> ISBN</label>
          <label className="flex items-center gap-1"><input type="radio" name="column" value="language" checked={searchIn === 'language'} onChange={() => setSearchIn('language')} /> Language</label>
          <label className="flex items-center gap-1"><input type="radio" name="column" value="md5" checked={searchIn === 'md5'} onChange={() => setSearchIn('md5')} /> MD5</label>
          <label className="flex items-center gap-1"><input type="radio" name="column" value="tags" checked={searchIn === 'tags'} onChange={() => setSearchIn('tags')} /> Tags</label>
        </div>
        <Input
          placeholder={`Search by ${searchIn === 'def' ? 'keyword' : searchIn}`}
          value={pendingQuery}
          onChange={e => setPendingQuery(e.target.value)}
          className="w-full text-base px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={applyFilters} className="h-10 px-8 rounded-xl text-base font-semibold shadow bg-primary text-white hover:bg-primary/90">Search</Button>
      </div>
    </div>
  );

  // Pagination UI
  const Pagination = () => (
    <div className="flex flex-wrap items-center justify-center gap-2 my-8 text-sm font-sans">
      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-full shadow-sm">Prev</Button>
      {getPageNumbers().map((page, i) =>
        typeof page === 'number' ? (
          <Button key={page} variant={page === currentPage ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(page)} className={`rounded-full shadow-sm ${page === currentPage ? 'font-bold' : ''}`}>{page}</Button>
        ) : (
          <span key={i} className="px-2">…</span>
        )
      )}
      <span className="ml-2">of {totalPages}</span>
      <form onSubmit={e => { e.preventDefault(); const n = parseInt(jumpPage); if (n >= 1 && n <= totalPages) setCurrentPage(n); setJumpPage(''); }} className="inline-block ml-2">
        <Input value={jumpPage} onChange={e => setJumpPage(e.target.value.replace(/\D/g, ''))} placeholder="Go to" className="w-16 px-2 py-1 border border-gray-300 rounded-xl" />
      </form>
      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-full shadow-sm">Next</Button>
    </div>
  );

  const formatFileSize = (size: string) => {
    if (!size) return '';
    const bytes = parseInt(size);
    if (isNaN(bytes)) return size;
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let fileSize = bytes;
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }
    
    return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
  };

  const handleAuthorSearch = (author: string) => {
    const newQuery = author;
    const newSearchIn = 'author';
    setSearchQuery(newQuery);
    setSearchIn(newSearchIn);
    searchBooks(1, newQuery, { searchIn: newSearchIn });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Head>
        <title>THE DANIELS LIBRARY - Advanced Book Discovery Platform</title>
        <meta name="description" content="Modern LibGen search with beautiful UI, mobile-first design, and powerful filtering" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="container mx-auto px-2 sm:px-4 py-8 flex-1 w-full">
          <FilterBar />
          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-card shadow-xl mt-2">
            <table className="min-w-full text-sm font-sans border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-900/95 dark:bg-slate-900/95 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2 border-r border-slate-800 text-left font-semibold text-slate-200">Author(s)</th>
                  <th className="px-3 py-2 border-r border-slate-800 text-left font-semibold text-slate-200">Title</th>
                  <th className="px-3 py-2 border-r border-slate-800 text-left font-semibold text-slate-200">Publisher</th>
                  <th className="px-3 py-2 border-r border-slate-800 text-left font-semibold text-slate-200">Year</th>
                  <th className="px-3 py-2 border-r border-slate-800 text-left font-semibold text-slate-200">Pages</th>
                  <th className="px-3 py-2 border-r border-slate-800 text-left font-semibold text-slate-200">Language</th>
                  <th className="px-3 py-2 border-r border-slate-800 text-left font-semibold text-slate-200">Size</th>
                  <th className="px-3 py-2 border-r border-slate-800 text-left font-semibold text-slate-200">Ext</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-200">Cover</th>
                </tr>
              </thead>
              <tbody>
                {pagedBooks.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-400">No books found. Try different search terms or filters.</td></tr>
                ) : (
                  pagedBooks.map((book, idx) => (
                    <tr key={book.md5} className={idx % 2 === 0 ? "bg-slate-900/80" : "bg-slate-800/80"}>
                      <td className="px-3 py-2 border-r border-slate-800 max-w-[120px] truncate text-slate-100">{book.author}</td>
                      <td className="px-3 py-2 border-r border-slate-800 max-w-[200px] truncate text-blue-300 hover:underline cursor-pointer" onClick={() => setSelectedBook(book)}>{book.title}</td>
                      <td className="px-3 py-2 border-r border-slate-800 max-w-[100px] truncate text-slate-100">{book.publisher}</td>
                      <td className="px-3 py-2 border-r border-slate-800 text-slate-100">{book.year}</td>
                      <td className="px-3 py-2 border-r border-slate-800 text-slate-100">{book.pages}</td>
                      <td className="px-3 py-2 border-r border-slate-800 text-slate-100">{book.language}</td>
                      <td className="px-3 py-2 border-r border-slate-800 text-slate-100">{formatFileSize(book.filesize)}</td>
                      <td className="px-3 py-2 border-r border-slate-800 text-slate-100">{book.extension?.toUpperCase()}</td>
                      <td className="px-3 py-2"><BookCover rawCoverUrl={book.rawCoverUrl} title={book.title} author={book.author} isbn={book.isbn} extension={book.extension} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination />
        </main>

        {selectedBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-card rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
              <button className="absolute top-2 right-2 text-xl" onClick={() => setSelectedBook(null)} aria-label="Close">×</button>
              <div className="flex gap-4 mb-4">
                <div className="flex-shrink-0">
                  <BookCover rawCoverUrl={selectedBook.rawCoverUrl} title={selectedBook.title} author={selectedBook.author} isbn={selectedBook.isbn} extension={selectedBook.extension} className="w-32 h-44 rounded-lg border" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-xl mb-1">{selectedBook.title}</h2>
                  <div className="text-muted-foreground mb-2">by {selectedBook.author}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="font-medium">Publisher:</span> <span>{selectedBook.publisher}</span>
                    <span className="font-medium">Year:</span> <span>{selectedBook.year}</span>
                    <span className="font-medium">Pages:</span> <span>{selectedBook.pages}</span>
                    <span className="font-medium">Language:</span> <span>{selectedBook.language}</span>
                    <span className="font-medium">Size:</span> <span>{formatFileSize(selectedBook.filesize)}</span>
                    <span className="font-medium">Extension:</span> <span>{selectedBook.extension?.toUpperCase()}</span>
                    <span className="font-medium">ISBN:</span> <span>{selectedBook.isbn}</span>
                    <span className="font-medium">Series:</span> <span>{selectedBook.series}</span>
                    <span className="font-medium">Tags:</span> <span>{selectedBook.tags}</span>
                    <span className="font-medium">MD5:</span> <span className="break-all">{selectedBook.md5}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <DownloadButton md5={selectedBook.md5} title={selectedBook.title} />
              </div>
            </div>
          </div>
        )}

        <Toaster />
      </div>
    </>
  );
}