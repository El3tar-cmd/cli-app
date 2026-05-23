/**
 * 🔎 NOVA Web Search Tool — Multi-provider search (Tavily, Brave Search, SerpApi, DuckDuckGo Puppeteer Fallback)
 */

import { ToolRegistry, type ToolResult } from './tool-registry.js';
import puppeteer from 'puppeteer-core';
import { findBrowser } from './browser.js';
import { logger } from '../utils/logger.js';

export function registerWebSearchTool(registry: ToolRegistry, cwd: string): void {
  registry.register({
    name: 'web_search',
    description: 'Search the internet for up-to-date documentation, solutions, package releases, or news using Tavily, Brave Search, SerpApi, or a Puppeteer-based DuckDuckGo fallback.',
    category: 'web',
    requiresConfirmation: false,
    parameters: {
      query: 'string',
      provider: 'string?'
    },
    handler: async (args): Promise<ToolResult> => {
      const query = args.query as string;
      const provider = (args.provider as string || 'auto').toLowerCase();

      if (!query) {
        return { success: false, output: '', error: 'Search query is required' };
      }

      // Check environment variables
      const TAVILY_KEY = process.env.TAVILY_API_KEY;
      const BRAVE_KEY = process.env.BRAVE_SEARCH_API_KEY;
      const SERPAPI_KEY = process.env.SERPAPI_API_KEY;

      // Select active provider
      let activeProvider = provider;
      if (activeProvider === 'auto') {
        if (TAVILY_KEY) activeProvider = 'tavily';
        else if (BRAVE_KEY) activeProvider = 'brave';
        else if (SERPAPI_KEY) activeProvider = 'serpapi';
        else activeProvider = 'duckduckgo';
      }

      try {
        if (activeProvider === 'tavily') {
          if (!TAVILY_KEY) throw new Error('Tavily API key is not configured in environment variables (TAVILY_API_KEY).');
          const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: TAVILY_KEY,
              query: query,
              max_results: 5,
              include_answer: true
            })
          });
          if (!res.ok) throw new Error(`Tavily search API error: HTTP ${res.status}`);
          const data = await res.json() as any;
          
          let output = `🔎 Web search results for "${query}" via Tavily:\n\n`;
          if (data.answer) {
            output += `💡 Quick Answer:\n${data.answer}\n\n`;
          }
          if (data.results && data.results.length > 0) {
            output += `Results:\n`;
            for (const r of data.results) {
              output += `- **${r.title}** (${r.url})\n  ${r.content}\n\n`;
            }
          } else {
            output += `No search results found.\n`;
          }
          return { success: true, output };
        } 
        
        if (activeProvider === 'brave') {
          if (!BRAVE_KEY) throw new Error('Brave Search API key is not configured in environment variables (BRAVE_SEARCH_API_KEY).');
          const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
          const res = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'X-Subscription-Token': BRAVE_KEY
            }
          });
          if (!res.ok) throw new Error(`Brave Search API error: HTTP ${res.status}`);
          const data = await res.json() as any;
          
          let output = `🔎 Web search results for "${query}" via Brave Search:\n\n`;
          const results = data.web?.results;
          if (results && results.length > 0) {
            for (const r of results) {
              output += `- **${r.title}** (${r.url})\n  ${r.description || r.snippet}\n\n`;
            }
          } else {
            output += `No search results found.\n`;
          }
          return { success: true, output };
        }

        if (activeProvider === 'serpapi') {
          if (!SERPAPI_KEY) throw new Error('SerpApi key is not configured in environment variables (SERPAPI_API_KEY).');
          const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`SerpApi search error: HTTP ${res.status}`);
          const data = await res.json() as any;

          let output = `🔎 Web search results for "${query}" via SerpApi:\n\n`;
          const results = data.organic_results;
          if (results && results.length > 0) {
            for (const r of results.slice(0, 5)) {
              output += `- **${r.title}** (${r.link})\n  ${r.snippet}\n\n`;
            }
          } else {
            output += `No search results found.\n`;
          }
          return { success: true, output };
        }

        // Fallback: DuckDuckGo using headless Puppeteer
        if (activeProvider === 'duckduckgo') {
          const executablePath = findBrowser();
          if (!executablePath) {
            throw new Error('No system browser (Chrome/Edge) found for DuckDuckGo fallback search.');
          }

          const browser = await puppeteer.launch({
            executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });

          try {
            const page = await browser.newPage();
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            
            const results = await page.evaluate(() => {
              const items: Array<{ title: string; url: string; snippet: string }> = [];
              const elements = document.querySelectorAll('.result');
              for (let i = 0; i < Math.min(elements.length, 5); i++) {
                const titleEl = elements[i].querySelector('.result__a') || elements[i].querySelector('.result__title a');
                const snippetEl = elements[i].querySelector('.result__snippet');
                if (titleEl) {
                  items.push({
                    title: (titleEl.textContent || '').trim(),
                    url: titleEl.getAttribute('href') || '',
                    snippet: snippetEl ? (snippetEl.textContent || '').trim() : ''
                  });
                }
              }
              return items;
            });

            let output = `🔎 Web search results for "${query}" via DuckDuckGo (Zero-Config Fallback):\n\n`;
            if (results.length > 0) {
              for (const r of results) {
                let realUrl = r.url;
                if (realUrl.startsWith('//duckduckgo.com/l/?uddg=')) {
                  const searchParams = new URLSearchParams(realUrl.substring(realUrl.indexOf('?')));
                  realUrl = searchParams.get('uddg') || realUrl;
                }
                output += `- **${r.title}** (${realUrl})\n  ${r.snippet}\n\n`;
              }
            } else {
              output += `No search results found.\n`;
            }

            return { success: true, output };
          } finally {
            await browser.close();
          }
        }

        throw new Error(`Unsupported search provider: ${provider}`);
      } catch (err: any) {
        logger.error('Web search tool error', err);
        return { success: false, output: '', error: `Search failed: ${err.message}` };
      }
    }
  });
}
