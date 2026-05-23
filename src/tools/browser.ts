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
export function findBrowser(): string | null {
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
let consoleLogs: string[] = [];

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

  // Attach persistent console listener (once per page)
  consoleLogs = [];
  activePage.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    // Keep buffer bounded
    if (consoleLogs.length > 500) consoleLogs.shift();
  });

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
        const script = args.script as string;
        // Wrap in function to avoid deprecated string evaluation
        const result = await page.evaluate((code: string) => {
          return new Function(`return (async () => { ${code} })()`)();
        }, script);
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
        // Ensure page exists so listener is attached
        await getPage();

        // Return collected logs and clear buffer
        const snapshot = [...consoleLogs];
        consoleLogs = [];

        return { success: true, output: snapshot.length > 0 ? snapshot.join('\n') : 'No console messages captured' };
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
          consoleLogs = [];
        }
        return { success: true, output: '✔ Browser closed' };
      } catch (err: any) {
        return { success: false, output: '', error: `Close failed: ${err.message}` };
      }
    },
  });

  // ── browser_inspect_ui ──────────────────────────
  registry.register({
    name: 'browser_inspect_ui',
    description: 'Inspect the current browser page layout for non-vision models. Returns a detailed textual wireframe: interactive elements with coordinates, overlapping elements, broken images, off-screen content, truncated text, and console errors. Use this instead of screenshots when the AI model cannot see images.',
    category: 'web',
    requiresConfirmation: false,
    parameters: {
      selector: 'string?',
      maxElements: 'number?',
    },
    handler: async (args): Promise<ToolResult> => {
      try {
        const page = await getPage();
        const rootSelector = (args.selector as string) || 'body';
        const maxEls = Math.min((args.maxElements as number) || 100, 200);

        const inspection = await page.evaluate((rootSel: string, maxElements: number) => {
          const root = document.querySelector(rootSel) || document.body;
          const viewport = { width: window.innerWidth, height: window.innerHeight };

          // ── 1. Collect interactive elements ──
          const interactiveSelectors = 'a, button, input, select, textarea, [role="button"], [onclick], [tabindex], details, summary';
          const allInteractive = Array.from(root.querySelectorAll(interactiveSelectors)).slice(0, maxElements);

          const elements: Array<{
            tag: string;
            type?: string;
            id?: string;
            selector: string;
            text: string;
            value?: string;
            placeholder?: string;
            bounds: { top: number; left: number; width: number; height: number };
            visible: boolean;
            disabled: boolean;
          }> = [];

          // Build a unique CSS selector for an element
          const getSelector = (el: Element): string => {
            if (el.id) return `#${el.id}`;
            const tag = el.tagName.toLowerCase();
            const cls = Array.from(el.classList).slice(0, 2).join('.');
            const parent = el.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
              if (siblings.length > 1) {
                const idx = siblings.indexOf(el) + 1;
                return `${parent.id ? '#' + parent.id + ' > ' : ''}${tag}${cls ? '.' + cls : ''}:nth-of-type(${idx})`;
              }
            }
            return `${tag}${cls ? '.' + cls : ''}`;
          };

          for (const el of allInteractive) {
            const rect = el.getBoundingClientRect();
            const htmlEl = el as HTMLElement;
            const inputEl = el as HTMLInputElement;
            elements.push({
              tag: el.tagName.toLowerCase(),
              type: el.getAttribute('type') || undefined,
              id: el.id || undefined,
              selector: getSelector(el),
              text: (htmlEl.innerText || el.textContent || '').trim().slice(0, 80),
              value: inputEl.value || undefined,
              placeholder: el.getAttribute('placeholder') || undefined,
              bounds: {
                top: Math.round(rect.top),
                left: Math.round(rect.left),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              visible: rect.width > 0 && rect.height > 0 && htmlEl.offsetParent !== null,
              disabled: (el as any).disabled === true,
            });
          }

          // ── 2. Detect overlapping elements ──
          const overlaps: Array<{ el1: string; el2: string; area: number }> = [];
          const visibleEls = elements.filter(e => e.visible);
          for (let i = 0; i < visibleEls.length && i < 50; i++) {
            for (let j = i + 1; j < visibleEls.length && j < 50; j++) {
              const a = visibleEls[i].bounds;
              const b = visibleEls[j].bounds;
              const overlapX = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
              const overlapY = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
              const overlapArea = overlapX * overlapY;
              if (overlapArea > 100) { // Significant overlap threshold (10x10px)
                overlaps.push({
                  el1: visibleEls[i].selector,
                  el2: visibleEls[j].selector,
                  area: overlapArea,
                });
              }
            }
          }

          // ── 3. Detect off-screen elements ──
          const offScreen = elements.filter(e => {
            const b = e.bounds;
            return e.visible && (
              b.left + b.width < 0 || b.top + b.height < 0 ||
              b.left > viewport.width || b.top > viewport.height
            );
          }).map(e => e.selector);

          // ── 4. Detect broken images ──
          const allImages = Array.from(root.querySelectorAll('img')).slice(0, 50);
          const brokenImages = allImages
            .filter(img => img.complete && img.naturalWidth === 0)
            .map(img => ({
              src: img.src?.slice(0, 120) || '(empty)',
              alt: img.alt || '(no alt)',
              selector: img.id ? `#${img.id}` : `img[src="${img.src?.slice(0, 60)}"]`,
            }));

          // ── 5. Detect truncated text ──
          const textContainers = Array.from(root.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, li, td, th, label')).slice(0, 100);
          const truncatedText = textContainers
            .filter(el => {
              const style = window.getComputedStyle(el);
              return (
                (style.overflow === 'hidden' || style.textOverflow === 'ellipsis') &&
                (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 5
              );
            })
            .slice(0, 15)
            .map(el => ({
              selector: el.id ? `#${el.id}` : el.tagName.toLowerCase() + (el.className ? '.' + Array.from(el.classList).slice(0, 2).join('.') : ''),
              visibleText: (el as HTMLElement).innerText?.slice(0, 60) || '',
              fullWidth: (el as HTMLElement).scrollWidth,
              containerWidth: (el as HTMLElement).clientWidth,
            }));

          // ── 6. Page meta info ──
          const title = document.title;
          const url = window.location.href;
          const bodyBounds = document.body.getBoundingClientRect();

          return {
            page: { title, url, viewport, bodyHeight: Math.round(bodyBounds.height) },
            elements,
            diagnostics: {
              overlaps,
              offScreen,
              brokenImages,
              truncatedText,
            },
          };
        }, rootSelector, maxEls);

        // ── Format the inspection result as readable text for the LLM ──
        const lines: string[] = [];

        // Page info
        lines.push(`📄 PAGE: "${inspection.page.title}"`);
        lines.push(`   URL: ${inspection.page.url}`);
        lines.push(`   Viewport: ${inspection.page.viewport.width}x${inspection.page.viewport.height}, Body Height: ${inspection.page.bodyHeight}px`);
        lines.push('');

        // Interactive elements
        lines.push(`🎯 INTERACTIVE ELEMENTS (${inspection.elements.length}):`);
        for (const el of inspection.elements) {
          const vis = el.visible ? '' : ' [HIDDEN]';
          const dis = el.disabled ? ' [DISABLED]' : '';
          const val = el.value ? ` value="${el.value}"` : '';
          const ph = el.placeholder ? ` placeholder="${el.placeholder}"` : '';
          const txt = el.text ? ` "${el.text}"` : '';
          lines.push(`  • <${el.tag}${el.type ? ` type="${el.type}"` : ''}> ${el.selector}${txt}${val}${ph}${vis}${dis}`);
          lines.push(`    📐 pos=(${el.bounds.left},${el.bounds.top}) size=${el.bounds.width}x${el.bounds.height}`);
        }
        lines.push('');

        // Diagnostics
        const diag = inspection.diagnostics;
        const hasIssues = diag.overlaps.length > 0 || diag.offScreen.length > 0 || diag.brokenImages.length > 0 || diag.truncatedText.length > 0;

        if (hasIssues) {
          lines.push('⚠️ UI DIAGNOSTICS:');

          if (diag.overlaps.length > 0) {
            lines.push(`  🔀 OVERLAPPING ELEMENTS (${diag.overlaps.length}):`);
            for (const o of diag.overlaps) {
              lines.push(`    • ${o.el1} ↔ ${o.el2} (overlap area: ${o.area}px²)`);
            }
          }

          if (diag.offScreen.length > 0) {
            lines.push(`  📤 OFF-SCREEN ELEMENTS (${diag.offScreen.length}):`);
            for (const s of diag.offScreen) {
              lines.push(`    • ${s}`);
            }
          }

          if (diag.brokenImages.length > 0) {
            lines.push(`  🖼️ BROKEN IMAGES (${diag.brokenImages.length}):`);
            for (const img of diag.brokenImages) {
              lines.push(`    • ${img.selector} — src: ${img.src} — alt: "${img.alt}"`);
            }
          }

          if (diag.truncatedText.length > 0) {
            lines.push(`  ✂️ TRUNCATED TEXT (${diag.truncatedText.length}):`);
            for (const t of diag.truncatedText) {
              lines.push(`    • ${t.selector} — visible: "${t.visibleText}..." (container: ${t.containerWidth}px, content: ${t.fullWidth}px)`);
            }
          }
        } else {
          lines.push('✅ UI DIAGNOSTICS: No layout issues detected.');
        }

        // Console errors
        const errors = consoleLogs.filter(l => l.startsWith('[error]'));
        if (errors.length > 0) {
          lines.push('');
          lines.push(`🔴 CONSOLE ERRORS (${errors.length}):`);
          for (const e of errors.slice(-10)) {
            lines.push(`  ${e}`);
          }
        }

        return {
          success: true,
          output: lines.join('\n'),
          metadata: {
            elementCount: inspection.elements.length,
            issueCount: diag.overlaps.length + diag.offScreen.length + diag.brokenImages.length + diag.truncatedText.length,
          },
        };
      } catch (err: any) {
        return { success: false, output: '', error: `UI Inspection failed: ${err.message}` };
      }
    },
  });
}


/** Take a headless screenshot of any URL and save it */
export async function captureHeadlessScreenshot(url: string, outputPath: string): Promise<void> {
  const executablePath = findBrowser();
  if (!executablePath) {
    throw new Error('No Chrome/Edge found. Install Chrome or Edge to use browser previews.');
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true, // true for headless background capture!
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    // Wait for network to be idle to ensure SPA has finished rendering
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // Add extra 1s delay just to be completely sure layout transitions finished
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: outputPath, fullPage: false });
  } finally {
    await browser.close();
  }
}
