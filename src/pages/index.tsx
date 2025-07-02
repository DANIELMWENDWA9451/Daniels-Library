import React, { useState, useCallback, useEffect, useRef } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Book, Filter, Loader2, ChevronLeft, ChevronRight, 
  Plus, X, Settings, Menu, Download, Star, Calendar, FileText, 
  Users, Globe, HardDrive, Zap, TrendingUp, Check, ChevronDown,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Grid, List, MoreHorizontal,
  BookOpen, User, Building, Hash, Languages, Tag, Clock, FileType,
  SortAsc, SortDesc, RefreshCw, Bookmark, ExternalLink
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DownloadButton } from "@/components/DownloadButton";
import { BookCover } from "@/components/BookCover";
import { cn } from "@/lib/utils";
import { searchCache, generateSearchKey } from "@/lib/cache";
import type { LibGenBook, SearchResponse } from "./api/search";
import { useRouter } from 'next/router';
import Header from "@/components/Header";

// Topics data structure matching LibGen's actual topics
const TOPICS = [
  {
    id: 'topicid210',
    label: 'Technology',
    children: [
      { id: 'topicid212', label: 'Aerospace Equipment' },
      { id: 'topicid211', label: 'Automation' },
      { id: 'topicid235', label: 'Communication: Telecommunications' },
      { id: 'topicid234', label: 'Communication' },
      { id: 'topicid236', label: 'Construction' },
      { id: 'topicid257', label: 'Electronics: Robotics' },
      { id: 'topicid220', label: 'Mechanical Engineering' },
      { id: 'topicid224', label: 'Nanotechnology' },
      { id: 'topicid216', label: 'Publishing' },
    ],
  },
  {
    id: 'topicid57',
    label: 'Art',
    children: [
      { id: 'topicid60', label: 'Cinema' },
      { id: 'topicid58', label: 'Design: Architecture' },
      { id: 'topicid61', label: 'Music' },
      { id: 'topicid63', label: 'Photo' },
    ],
  },
  {
    id: 'topicid12',
    label: 'Biology',
    children: [
      { id: 'topicid14', label: 'Anthropology' },
      { id: 'topicid16', label: 'Biostatistics' },
      { id: 'topicid22', label: 'Genetics' },
      { id: 'topicid31', label: 'Ecology' },
    ],
  },
  {
    id: 'topicid69',
    label: 'Computers',
    children: [
      { id: 'topicid71', label: 'Algorithms and Data Structures' },
      { id: 'topicid82', label: 'Cryptography' },
      { id: 'topicid76', label: 'Databases' },
      { id: 'topicid87', label: 'Programming' },
      { id: 'topicid99', label: 'Networking' },
    ],
  },
  {
    id: 'topicid113',
    label: 'Mathematics',
    children: [
      { id: 'topicid114', label: 'Algebra' },
      { id: 'topicid117', label: 'Analysis' },
      { id: 'topicid121', label: 'Geometry and Topology' },
      { id: 'topicid119', label: 'Probability' },
    ],
  },
  {
    id: 'topicid147',
    label: 'Medicine',
    children: [
      { id: 'topicid148', label: 'Anatomy and physiology' },
      { id: 'topicid159', label: 'Cardiology' },
      { id: 'topicid166', label: 'Oncology' },
      { id: 'topicid173', label: 'Pharmacology' },
    ],
  },
  {
    id: 'topicid264',
    label: 'Physics',
    children: [
      { id: 'topicid265', label: 'Astronomy' },
      { id: 'topicid268', label: 'Quantum Mechanics' },
      { id: 'topicid271', label: 'Mechanics' },
      { id: 'topicid279', label: 'Optics' },
    ],
  },
];

// Languages available in LibGen
const LANGUAGES = [
  'English', 'Russian', 'German', 'French', 'Spanish', 'Italian', 
  'Portuguese', 'Chinese', 'Japanese', 'Arabic', 'Dutch', 'Polish',
  'Czech', 'Hungarian', 'Romanian', 'Bulgarian', 'Croatian', 'Serbian',
  'Ukrainian', 'Belarusian', 'Lithuanian', 'Latvian', 'Estonian',
  'Finnish', 'Swedish', 'Norwegian', 'Danish', 'Greek', 'Turkish',
  'Hebrew', 'Persian', 'Hindi', 'Korean', 'Thai', 'Vietnamese'
];

// File extensions available in LibGen
const EXTENSIONS = [
  'pdf', 'epub', 'djvu', 'mobi', 'azw', 'azw3', 'fb2', 'txt', 'rtf',
  'doc', 'docx', 'chm', 'lit', 'pdb', 'html', 'htm', 'zip', 'rar',
  '7z', 'tar', 'gz', 'bz2', 'iso', 'mdf', 'nrg', 'img', 'bin', 'cue'
];

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

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [books, setBooks] = useState<LibGenBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchIn, setSearchIn] = useState("def");
  const [sortBy, setSortBy] = useState("def");
  const [reverse, setReverse] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(25);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedSubTopic, setSelectedSubTopic] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [selectedExtension, setSelectedExtension] = useState("");
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedBook, setSelectedBook] = useState<LibGenBook | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isCached, setIsCached] = useState(false);
  
  const { toast } = useToast();
  const router = useRouter();

  // Get subtopics for selected topic
  const subTopics = TOPICS.find(t => t.id === selectedTopic)?.children || [];

  const searchBooks = useCallback(async (page = 1, newQuery?: string) => {
    const queryToUse = newQuery || searchQuery;
    
    if (!queryToUse.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a book title, author, or keyword to search.",
        variant: "destructive",
      });
      return;
    }

    if (queryToUse.trim().length < 2) {
      toast({
        title: "Search term too short",
        description: "Please enter at least 2 characters for better search results.",
        variant: "destructive",
      });
      return;
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
        search_in: searchIn,
        sort_by: sortBy,
        reverse: reverse,
        topic: selectedSubTopic || selectedTopic,
        year_from: yearFrom,
        year_to: yearTo,
        language: selectedLanguage,
        extension: selectedExtension,
      };

      const cacheKey = generateSearchKey(queryToUse, searchOptions);
      const cachedResult = searchCache.get(cacheKey);
      
      if (cachedResult) {
        setBooks(cachedResult.books);
        setTotalResults(cachedResult.totalResults || cachedResult.books.length);
        setTotalPages(cachedResult.totalPages || Math.ceil(cachedResult.books.length / resultsPerPage));
        setCurrentPage(page);
        setIsCached(true);
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
        setTotalPages(0);
      } else {
        searchCache.set(cacheKey, data);
        setBooks(data.books);
        setTotalResults(data.totalResults || data.books.length);
        setTotalPages(data.totalPages || Math.ceil(data.books.length / resultsPerPage));
        setCurrentPage(page);
        
        if (data.books.length === 0) {
          toast({
            title: "No results found",
            description: "Try adjusting your search terms or filters.",
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
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, searchIn, sortBy, reverse, resultsPerPage, selectedTopic, selectedSubTopic, yearFrom, yearTo, selectedLanguage, selectedExtension, toast]);

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort books based on current sort settings
  const sortedBooks = React.useMemo(() => {
    if (!sortColumn) return books;
    
    return [...books].sort((a, b) => {
      let aVal = a[sortColumn as keyof LibGenBook] || '';
      let bVal = b[sortColumn as keyof LibGenBook] || '';
      
      // Handle numeric fields
      if (['year', 'pages', 'filesize_bytes'].includes(sortColumn)) {
        aVal = parseInt(aVal as string) || 0;
        bVal = parseInt(bVal as string) || 0;
        const result = (aVal as number) - (bVal as number);
        return sortDirection === 'asc' ? result : -result;
      }
      
      // Handle string fields
      const result = String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? result : -result;
    });
  }, [books, sortColumn, sortDirection]);

  // Pagination
  const totalPagesCalc = Math.ceil(totalResults / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage + 1;
  const endIndex = Math.min(currentPage * resultsPerPage, totalResults);

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

  const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <th 
      className="px-4 py-3 text-left font-semibold text-slate-200 cursor-pointer hover:bg-slate-800/50 transition-colors select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortColumn === column ? (
          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
        ) : (
          <ArrowUpDown className="w-4 h-4 opacity-50" />
        )}
      </div>
    </th>
  );

  const Pagination = () => {
    const getPageNumbers = () => {
      const pages = [];
      const maxVisible = 7;
      
      if (totalPagesCalc <= maxVisible) {
        for (let i = 1; i <= totalPagesCalc; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        
        if (currentPage > 4) {
          pages.push('...');
        }
        
        const start = Math.max(2, currentPage - 2);
        const end = Math.min(totalPagesCalc - 1, currentPage + 2);
        
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
        
        if (currentPage < totalPagesCalc - 3) {
          pages.push('...');
        }
        
        if (totalPagesCalc > 1) {
          pages.push(totalPagesCalc);
        }
      }
      
      return pages;
    };

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-card rounded-xl border">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex}-{endIndex} of {totalResults} results
          {isCached && <Badge variant="outline" className="ml-2">Cached</Badge>}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1 || loading}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) => (
              typeof page === 'number' ? (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  disabled={loading}
                  className="min-w-[40px]"
                >
                  {page}
                </Button>
              ) : (
                <span key={index} className="px-2 text-muted-foreground">
                  {page}
                </span>
              )
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPagesCalc, p + 1))}
            disabled={currentPage === totalPagesCalc || loading}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>LibGen Pro - Advanced Academic Library Search</title>
        <meta name="description" content="Modern LibGen search with advanced filtering, sorting, and beautiful UI" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        
        <main className="container mx-auto px-4 py-8 flex-1 max-w-7xl">
          {/* Advanced Search Interface */}
          <Card className="mb-8 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm border-slate-700">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold gradient-text">Advanced Search</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className="lg:hidden"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Main Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  placeholder="Search for books, authors, topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchBooks(1)}
                  className="pl-10 pr-4 py-3 text-lg rounded-xl border-slate-600 bg-slate-800/50 focus:bg-slate-800 transition-colors"
                  autoFocus
                />
                <Button
                  onClick={() => searchBooks(1)}
                  disabled={loading || !searchQuery.trim()}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 button-gradient rounded-lg"
                  size="sm"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {/* Search Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Search In</Label>
                  <Select value={searchIn} onValueChange={setSearchIn}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="def">All Fields</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="author">Author</SelectItem>
                      <SelectItem value="series">Series</SelectItem>
                      <SelectItem value="publisher">Publisher</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                      <SelectItem value="identifier">ISBN</SelectItem>
                      <SelectItem value="language">Language</SelectItem>
                      <SelectItem value="md5">MD5</SelectItem>
                      <SelectItem value="tags">Tags</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="def">Relevance</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="author">Author</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                      <SelectItem value="publisher">Publisher</SelectItem>
                      <SelectItem value="pages">Pages</SelectItem>
                      <SelectItem value="filesize">File Size</SelectItem>
                      <SelectItem value="extension">Extension</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Results Per Page</Label>
                  <Select value={String(resultsPerPage)} onValueChange={(v) => setResultsPerPage(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="reverse-sort"
                      checked={reverse}
                      onCheckedChange={setReverse}
                    />
                    <Label htmlFor="reverse-sort" className="text-sm">Reverse Sort</Label>
                  </div>
                </div>
              </div>

              {/* Advanced Filters */}
              <div className={cn("space-y-4 transition-all duration-300", filtersOpen || "lg:block hidden")}>
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Topic Selection */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Topic</Label>
                    <Select value={selectedTopic} onValueChange={(value) => {
                      setSelectedTopic(value);
                      setSelectedSubTopic('');
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select topic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Topics</SelectItem>
                        {TOPICS.map(topic => (
                          <SelectItem key={topic.id} value={topic.id}>
                            {topic.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subtopic Selection */}
                  {subTopics.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Subtopic</Label>
                      <Select value={selectedSubTopic} onValueChange={setSelectedSubTopic}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subtopic" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Subtopics</SelectItem>
                          {subTopics.map(subtopic => (
                            <SelectItem key={subtopic.id} value={subtopic.id}>
                              {subtopic.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Language Filter */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Language</Label>
                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any Language</SelectItem>
                        {LANGUAGES.map(lang => (
                          <SelectItem key={lang} value={lang}>
                            {lang}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Extension Filter */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">File Type</Label>
                    <Select value={selectedExtension} onValueChange={setSelectedExtension}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any Format</SelectItem>
                        {EXTENSIONS.map(ext => (
                          <SelectItem key={ext} value={ext}>
                            {ext.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Year Range */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Year From</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 2000"
                      value={yearFrom}
                      onChange={(e) => setYearFrom(e.target.value)}
                      min="1800"
                      max="2024"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Year To</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 2024"
                      value={yearTo}
                      onChange={(e) => setYearTo(e.target.value)}
                      min="1800"
                      max="2024"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          {hasSearched && (
            <Card className="bg-card/95 backdrop-blur-sm border-slate-700">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold">
                      Search Results
                      {totalResults > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {totalResults.toLocaleString()} books
                        </Badge>
                      )}
                    </CardTitle>
                    {searchQuery && (
                      <p className="text-muted-foreground mt-1">
                        Results for "{searchQuery}"
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => searchBooks(currentPage)}
                      disabled={loading}
                    >
                      <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                      Refresh
                    </Button>
                    
                    <div className="flex items-center border rounded-lg">
                      <Button
                        variant={viewMode === 'table' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                        className="rounded-r-none"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className="rounded-l-none"
                      >
                        <Grid className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                      <p className="text-muted-foreground">Searching library...</p>
                    </div>
                  </div>
                ) : books.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No books found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search terms or filters
                    </p>
                  </div>
                ) : viewMode === 'table' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-900/50 border-b border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-200 w-16">Cover</th>
                          <SortableHeader column="title">Title</SortableHeader>
                          <SortableHeader column="author">Author</SortableHeader>
                          <SortableHeader column="year">Year</SortableHeader>
                          <SortableHeader column="pages">Pages</SortableHeader>
                          <SortableHeader column="language">Language</SortableHeader>
                          <SortableHeader column="filesize">Size</SortableHeader>
                          <SortableHeader column="extension">Type</SortableHeader>
                          <th className="px-4 py-3 text-left font-semibold text-slate-200 w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedBooks.map((book, index) => (
                          <motion.tr
                            key={book.md5}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <BookCover
                                rawCoverUrl={book.rawCoverUrl}
                                title={book.title}
                                author={book.author}
                                isbn={book.isbn}
                                extension={book.extension}
                                className="w-12 h-16"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setSelectedBook(book)}
                                className="text-left hover:text-primary transition-colors"
                              >
                                <div className="font-medium line-clamp-2">{book.title}</div>
                                {book.series && (
                                  <div className="text-sm text-muted-foreground">
                                    Series: {book.series}
                                  </div>
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{book.author}</td>
                            <td className="px-4 py-3 text-muted-foreground">{book.year}</td>
                            <td className="px-4 py-3 text-muted-foreground">{book.pages}</td>
                            <td className="px-4 py-3 text-muted-foreground">{book.language}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatFileSize(book.filesize)}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-xs">
                                {book.extension?.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setSelectedBook(book)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem asChild>
                                    <div className="w-full">
                                      <DownloadButton md5={book.md5} title={book.title} />
                                    </div>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
                    {sortedBooks.map((book, index) => (
                      <motion.div
                        key={book.md5}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => setSelectedBook(book)}>
                          <CardContent className="p-4">
                            <div className="flex flex-col h-full">
                              <div className="flex-shrink-0 mb-4">
                                <BookCover
                                  rawCoverUrl={book.rawCoverUrl}
                                  title={book.title}
                                  author={book.author}
                                  isbn={book.isbn}
                                  extension={book.extension}
                                  className="w-full h-48 mx-auto"
                                />
                              </div>
                              
                              <div className="flex-1 space-y-2">
                                <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                                  {book.title}
                                </h3>
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {book.author}
                                </p>
                                
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{book.year}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {book.extension?.toUpperCase()}
                                  </Badge>
                                </div>
                                
                                <div className="text-xs text-muted-foreground">
                                  {book.pages && `${book.pages} pages`}
                                  {book.pages && book.filesize && ' • '}
                                  {formatFileSize(book.filesize)}
                                </div>
                              </div>
                              
                              <div className="mt-4 pt-4 border-t">
                                <DownloadButton md5={book.md5} title={book.title} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}

                {books.length > 0 && <Pagination />}
              </CardContent>
            </Card>
          )}
        </main>

        {/* Book Details Modal */}
        {selectedBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <h2 className="text-2xl font-bold">Book Details</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedBook(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1">
                    <BookCover
                      rawCoverUrl={selectedBook.rawCoverUrl}
                      title={selectedBook.title}
                      author={selectedBook.author}
                      isbn={selectedBook.isbn}
                      extension={selectedBook.extension}
                      className="w-full h-80 mx-auto"
                    />
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    <div>
                      <h3 className="text-xl font-bold mb-2">{selectedBook.title}</h3>
                      <p className="text-muted-foreground text-lg">{selectedBook.author}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { label: 'Publisher', value: selectedBook.publisher, icon: Building },
                        { label: 'Year', value: selectedBook.year, icon: Calendar },
                        { label: 'Pages', value: selectedBook.pages, icon: FileText },
                        { label: 'Language', value: selectedBook.language, icon: Languages },
                        { label: 'File Size', value: formatFileSize(selectedBook.filesize), icon: HardDrive },
                        { label: 'Format', value: selectedBook.extension?.toUpperCase(), icon: FileType },
                        { label: 'Series', value: selectedBook.series, icon: BookOpen },
                        { label: 'ISBN', value: selectedBook.isbn, icon: Hash },
                      ].map(({ label, value, icon: Icon }) => (
                        value && (
                          <div key={label} className="flex items-center gap-3">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">{label}</div>
                              <div className="font-medium">{value}</div>
                            </div>
                          </div>
                        )
                      ))}
                    </div>

                    {selectedBook.tags && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Tag className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Tags</span>
                        </div>
                        <p className="text-sm">{selectedBook.tags}</p>
                      </div>
                    )}

                    <div className="pt-4 border-t">
                      <DownloadButton md5={selectedBook.md5} title={selectedBook.title} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        <Toaster />
      </div>
    </>
  );
}