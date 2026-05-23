import puppeteer from 'puppeteer-core';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Helper to find Chrome path on Windows
function getChromePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function capture() {
  const chromePath = getChromePath();
  if (!chromePath) {
    console.error('❌ Google Chrome was not found on standard Windows paths.');
    process.exit(1);
  }

  console.log(`🚀 Launching Chrome from: ${chromePath}`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: { width: 1440, height: 900 }
  });

  try {
    const page = await browser.newPage();
    console.log('🔗 Navigating to Nova Studio on http://localhost:3142...');
    await page.goto('http://localhost:3142', { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait 5 seconds to ensure animations settle and WebSocket state populates
    console.log('⏳ Waiting for UI state synchronization...');
    await new Promise(r => setTimeout(r, 5000));

    const outputPath = 'C:\\Users\\root\\.gemini\\antigravity\\brain\\be142ce7-7a6c-4ef9-bd1a-1d515aaf2a7d\\studio_capture.png';
    console.log(`📸 Taking screenshot and saving to: ${outputPath}`);
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log('✅ Screenshot captured successfully!');
  } catch (err) {
    console.error('❌ Failed to capture screenshot:', err.message);
  } finally {
    await browser.close();
  }
}

capture();
