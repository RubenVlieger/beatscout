import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

async function waitForServer(url: string, maxAttempts: number = 60): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('Server is ready!');
        return true;
      }
    } catch {
      // Server not ready yet
    }
    console.log(`Waiting for server... (${i + 1}/${maxAttempts})`);
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function generatePreview() {
  console.log('Starting Next.js server...');

  // Start Next.js dev server
  const nextProcess = spawn('npm', ['run', 'dev'], {
    cwd: ROOT_DIR,
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' }
  });

  let serverPort: number | null = null;

  // Capture output to detect which port the server starts on
  nextProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Ready') || output.includes('ready')) {
      console.log('Server:', output.trim());
      // Try to extract port number
      const portMatch = output.match(/localhost:(\d+)/);
      if (portMatch) {
        serverPort = parseInt(portMatch[1], 10);
        console.log(`Detected server port: ${serverPort}`);
      }
    }
  });

  nextProcess.stderr.on('data', (data) => {
    const output = data.toString();
    if (!output.includes('DeprecationWarning') && !output.includes('experimental')) {
      console.error('Server:', output.trim());
      // Also check stderr for port info
      const portMatch = output.match(/localhost:(\d+)/);
      if (portMatch && !serverPort) {
        serverPort = parseInt(portMatch[1], 10);
        console.log(`Detected server port from stderr: ${serverPort}`);
      }
    }
  });

  try {
    // Wait a bit for server to start and detect port
    await new Promise(r => setTimeout(r, 5000));

    // Try common ports if we couldn't detect
    const portsToTry = serverPort ? [serverPort] : [3000, 3001, 3002, 3003];
    let serverUrl: string | null = null;

    for (const port of portsToTry) {
      const url = `http://localhost:${port}`;
      console.log(`Trying ${url}...`);
      const isReady = await waitForServer(url, 10);
      if (isReady) {
        serverUrl = url;
        console.log(`Server is ready at ${serverUrl}`);
        break;
      }
    }

    if (!serverUrl) {
      throw new Error('Server failed to start on any port');
    }

    // Give the server more time to fully initialize
    console.log('Server warming up...');
    await new Promise(r => setTimeout(r, 3000));

    console.log('Launching Playwright...');

    // Launch browser - WebGL works reliably in non-headless mode
    const browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-web-security',
        '--allow-file-access-from-files',
        '--disable-features=IsolateOrigins,site-per-process',
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    // Log browser console messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Canvas') || text.includes('WebGL') || text.includes('ready') || text.includes('error')) {
        console.log('Browser:', text);
      }
    });

    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });

    // Navigate to landing page with screenshot mode
    const screenshotUrl = `${serverUrl}/?screenshot=true`;
    console.log('Navigating to page:', screenshotUrl);
    await page.goto(screenshotUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Wait for canvas element
    console.log('Waiting for canvas element...');
    await page.waitForSelector('canvas', { timeout: 30000 });
    console.log('Canvas element found!');

    // Wait for data to load and render
    console.log('Waiting for scene to render (15 seconds)...');
    await page.waitForTimeout(15000);

    // Take screenshot
    const screenshotPath = path.join(ROOT_DIR, 'public', 'landing-bg.png');
    console.log('Taking screenshot...');
    await page.screenshot({
      path: screenshotPath,
      type: 'png',
      fullPage: false,
    });

    console.log('✓ Screenshot saved to:', screenshotPath);

    // Verify screenshot isn't too small (which would indicate it's mostly black)
    const stats = fs.statSync(screenshotPath);
    const sizeKB = stats.size / 1024;
    console.log(`Screenshot size: ${sizeKB.toFixed(1)} KB`);

    if (sizeKB < 50) {
      console.warn('⚠ Warning: Screenshot appears to be mostly black/empty');
      console.warn('This may be due to WebGL not rendering in headless mode.');
      console.warn('Try running the build on a system with GPU support.');
    } else {
      console.log('✓ Screenshot looks good!');
    }

    await context.close();
    await browser.close();
  } catch (error) {
    console.error('Error generating preview:', error);
    process.exit(1);
  } finally {
    // Kill the Next.js server
    console.log('Shutting down server...');
    nextProcess.kill('SIGTERM');

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (!nextProcess.killed) {
        nextProcess.kill('SIGKILL');
      }
    }, 5000);

    // Wait for process to actually exit
    await new Promise(resolve => {
      nextProcess.on('exit', resolve);
      setTimeout(resolve, 6000);
    });
  }
}

generatePreview().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});