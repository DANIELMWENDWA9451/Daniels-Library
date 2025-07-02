import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface DownloadResponse {
  directUrl?: string;
  ipfsUrls?: string[];
  torUrl?: string;
  error?: string;
}

// Session setup with retries and proper headers
const createSession = () => {
  const session = axios.create({
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });

  // Add retry interceptor
  session.interceptors.response.use(
    (response) => response,
    async (error) => {
      const { config } = error;
      if (!config || !config.retry) {
        config.retry = { count: 0, max: 3 };
      }

      if (config.retry.count < config.retry.max) {
        config.retry.count++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        return session.request(config);
      }

      return Promise.reject(error);
    }
  );

  return session;
};

// Core download logic ported from the sample program
async function getFinalDownloadLink(bookMd5: string): Promise<string | null> {
  console.log(`[*] Starting download process for MD5: ${bookMd5}`);
  
  const session = createSession();
  const baseUrl = "https://libgen.li";
  const adsPageUrl = `${baseUrl}/ads.php?md5=${bookMd5}`;

  try {
    console.log("  -> Visiting intermediate page to get the key...");
    const response = await session.get(adsPageUrl);
    
    const $ = cheerio.load(response.data);
    
    // Find the get.php link with the key
    const getLinkElement = $('a[href*="get.php"]').first();
    
    if (getLinkElement.length === 0) {
      console.log("[!] ERROR: Could not find the 'get.php' link with the key.");
      return null;
    }

    const href = getLinkElement.attr('href');
    if (!href) {
      console.log("[!] ERROR: get.php link has no href attribute.");
      return null;
    }

    // Extract the key from the href (format: get.php?md5=...&key=...)
    const keyMatch = href.match(/key=([^&]+)/);
    if (!keyMatch) {
      console.log("[!] ERROR: Could not extract key from get.php link.");
      return null;
    }

    const key = keyMatch[1];
    console.log(`  -> Extracted key: ${key}`);
    
    // Alternate between libgen.li, libgen.gs, and libgen.la for better load distribution
    const downloadMirrors = ['https://libgen.li', 'https://libgen.gs', 'https://libgen.la'];
    const selectedMirror = downloadMirrors[Math.floor(Math.random() * downloadMirrors.length)];
    
    // Construct the real download URL using the selected mirror
    const realDownloadUrl = `${selectedMirror}/get.php?md5=${bookMd5}&key=${key}`;
    
    console.log(`  -> Selected mirror: ${selectedMirror}`);
    console.log(`  -> Constructed real download URL: ${realDownloadUrl}`);
    console.log("[*] SUCCESS! This IS the final download link!");
    
    return realDownloadUrl;

  } catch (error) {
    console.log(`[!] ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DownloadResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { md5 } = req.body;

  if (!md5 || typeof md5 !== 'string') {
    return res.status(400).json({ error: 'MD5 hash is required' });
  }

  const md5Hash = md5.trim();
  
  // Validate MD5 format (32 hex characters)
  if (!/^[a-fA-F0-9]{32}$/.test(md5Hash)) {
    return res.status(400).json({ error: 'Invalid MD5 format. Must be 32 hexadecimal characters.' });
  }

  try {
    console.log(`[API] Processing MD5: ${md5Hash}`);
    const downloadLink = await getFinalDownloadLink(md5Hash);

    if (downloadLink) {
      console.log(`[API] Success! Returning link: ${downloadLink}`);
      return res.status(200).json({
        directUrl: downloadLink
      });
    } else {
      console.log(`[API] Failed to get download link for MD5: ${md5Hash}`);
      return res.status(404).json({ 
        error: 'Could not retrieve download link. Check if MD5 is valid.' 
      });
    }

  } catch (error) {
    console.error('[API] Error processing request:', error);
    res.status(500).json({ 
      error: 'Failed to get download links. Please try again later.' 
    });
  }
}