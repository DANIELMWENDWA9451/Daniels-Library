import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { DownloadResponse } from '@/pages/api/download';

interface DownloadButtonProps {
  md5: string;
  title: string;
}

export function DownloadButton({ md5, title }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ md5 }),
      });

      const data: DownloadResponse = await response.json();

      if (data.error) {
        toast({
          title: "Download failed",
          description: data.error,
          variant: "destructive",
        });
      } else if (data.directUrl) {
        triggerDownload(data.directUrl);
      } else {
        toast({
          title: "Download failed",
          description: "No direct download link found.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not get download link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = (url: string) => {
    const filename = `${title || 'book'}.${url.split('.').pop() || 'file'}`;
    
    // Create a temporary link to trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank'; // Open in a new tab to avoid navigation issues
    link.rel = 'noopener noreferrer';
    link.download = filename; // This attribute may not always work depending on browser/server policies
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download Initialized",
      description: "Your browser will now download the file. Please check your downloads folder.",
    });
  };

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full mt-auto">
      <Button 
        onClick={handleDownload}
        disabled={loading}
        className="w-full button-gradient text-primary-foreground rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
        size="sm"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        Download
      </Button>
    </motion.div>
  );
}