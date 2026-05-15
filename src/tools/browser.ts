/**
 * 🌐 NOVA Browser Tool — Headless browser automation using puppeteer-core
 * Uses the system's installed Chrome/Edge for browser testing
 */

import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ToolRegistry, type ToolResult } from './tool-registry.js';

// Find Chrome/Edge on the system
function findBrowser(): string | null {
  const paths = [
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge',
  ];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

let activeBrowser: Browser | null = null;
let activePage: Page | null = null;

async function getBrowser(): Promise<Browser> {
  if (activeBrowser?.connected) return activeBrowser;

  const executablePath = findBrowser();
  if (!executablePath) {
    throw new Error('No Chrome/Edge found. Install Chrome or Edge to use browser tools.');
  }

  activeBrowser = await puppeteer.launch({
    executablePath,
    headless: false, // Show the browser so user can see
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  return activeBrowser;
}

async function getPage(): Promise<Page> {
  if (activePage && !activePage.isClosed()) return activePage;
  const browser = await getBrowser();
  const pages = await browser.pages();
  activePage = pages[0] || await browser.newPage();
  return activePage;
}

export function registerBrowserTools(registry: ToolRegistry, cwd: string): void {

  // ── browser_navigate ─────────────────────────
  registry.register({
    name: 'browser_navigate',
    description: 'Open a URL in a real browser window. The browser will be visible. Use this to test websites, preview local dev servers, or inspect web pages.',
    category: 'web',
    requiresConfirmation: false,
    parameters: { url: 'string' },
    handler: async (args): Promise<ToolResult> => {
      try {
        const page = await getPage();
        await page.goto(args.url as string, { waitUntil: 'networkidle2', timeout: 30000 });
        const title = await page.title();
        return { success: true, output: `✔ Navigated to: ${args.url}\nPage title: ${title}` };
      } catch (err: any) {
        return { success: false, output: '', error: `Navigation failed: ${err.message}` };
      }
    },
  });

  // ── browser_screenshot ───────────────────────
  registry.register({
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current browser page. Saves to a file and returns the path. Use this to visually verify UI changes.',
    category: 'web',
    requiresConfirmation: false,
    parameters: { filename: 'string?' },
    handler: async (args): Promise<ToolResult> => {
      try {
        const page = await getPage();
        const filename = (args.filename as string) || `screenshot-${Date.now()}.png`;
        const filepath = join(cwd, filename);
        await page.screenshot({ path: filepath, fullPage: false });
        return { success: true, output: `✔ Screenshot saved: ${filename}` };
      } catch (err: any) {
        return { success: false, output: '', error: `Screenshot failed: ${err.message}` };
      }
    },
  });

  // ── browser_click ────────────────────────────
  registry.register({
    name: 'browser_click',
    description: 'Click an element on the page using a CSS selector.',
    category: 'web',
    requiresConfirmation: false,
    parameters: { selector: 'string' },
    handler: async (args): Promise<ToolResult> => {
      try {
        const page = await getPage();
        await page.waitForSelector(args.selector as string, { timeout: 5000 });
        await page.click(args.selector as string);
        return { success: true, output: `✔ Clicked: ${args.selector}` };
      } catch (err: any) {
        return { success: false, output: '', error: `Click failed: ${err.message}` };
      }
    },
  });

  // ── browser_type ─────────────────────────────
  registry.register({
    name: 'browser_type',
    description: 'Type text into an input field identified by CSS selector.',
    category: 'web',
    requiresConfirmation: false,
    parameters: { selector: 'string', text: 'string' },
    handler: async (args): Promise<ToolResult> => {
      try {
        const page = await getPage();
        await page.waitForSelector(args.selector as string, { timeout: 5000 });
        await page.type(args.selector as string, args.text as string);
        return { success: true, output: `✔ Typed "${args.text}" into ${args.selector}` };
      } catch (err: any) {
        return { success: false, output: '', error: `Type failed: ${err.message}` };
      }
    },
  });

  // ── browser_eval ─────────────────────────────
  registry.register({
    name: 'browser_eval',
    description: 'Execute JavaScript in the browser and return the result. Use to inspect DOM, check values, or run tests.',
    category: 'web',
    requiresConfirmation: false,
    parameters: { script: 'string' },
    handler: async (args): Promise<ToolResult> => {
      try {
        const page = await getPage();
        const result = await page.evaluate(args.script as string);
        return { success: true, output: JSON.stringify(result, null, 2) || '(undefined)' };
      } catch (err: any) {
        return { success: false, output: '', error: `Eval failed: ${err.message}` };
      }
    },
  });

  // ── browser_content ──────────────────────────
  registry.register({
    name: 'browser_content',
    description: 'Get the text content of the current page or a specific element.',
    category: 'web',
    requiresConfirmation: false,
    parameters: { selector: 'string?' },
    handler: async (args): Promise<ToolResult> => {
      try {
        const page = await getPage();
        const selector = args.selector as string;
        let text: string;
        if (selector) {
          text = await page.$eval(selector, (el: any) => el.textContent || el.innerText || '') as string;
        } else {
          text = await page.evaluate(() => (globalThis as any).document.body.innerText) as string;
        }
        return { success: true, output: text.slice(0, 5000) };
      } catch (err: any) {
        return { success: false, output: '', error: `Content extraction failed: ${err.message}` };
      }
    },
  });

  // ── browser_console ──────────────────────────
  registry.register({
    name: 'browser_console',
    description: 'Get console logs (errors, warnings) from the browser. Useful for debugging.',
    category: 'web',
    requiresConfirmation: false,
    parameters: {},
    handler: async (): Promise<ToolResult> => {
      try {
        const page = await getPage();
        const logs: string[] = [];

        // Listen for console events
        page.on('console', (msg) => {
          logs.push(`[${msg.type()}] ${msg.text()}`);
        });

        // Wait a moment to collect logs
        await new Promise(r => setTimeout(r, 1000));

        return { success: true, output: logs.length > 0 ? logs.join('\n') : 'No console messages captured' };
      } catch (err: any) {
        return { success: false, output: '', error: `Console capture failed: ${err.message}` };
      }
    },
  });

  // ── browser_close ────────────────────────────
  registry.register({
    name: 'browser_close',
    description: 'Close the browser instance.',
    category: 'web',
    requiresConfirmation: false,
    parameters: {},
    handler: async (): Promise<ToolResult> => {
      try {
        if (activeBrowser) {
          await activeBrowser.close();
          activeBrowser = null;
          activePage = null;
        }
        return { success: true, output: '✔ Browser closed' };
      } catch (err: any) {
        return { success: false, output: '', error: `Close failed: ${err.message}` };
      }
    },
  });
}
