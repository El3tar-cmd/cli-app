import { ToolRegistry } from './dist/tools/tool-registry.js';
import { registerBrowserTools } from './dist/tools/browser.js';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function runTests() {
  console.log('🚀 Starting render_graphics tool verification tests...');

  const registry = new ToolRegistry();
  const cwd = process.cwd();
  registerBrowserTools(registry, cwd);

  const renderGraphics = registry.get('render_graphics');
  if (!renderGraphics) {
    console.error('❌ Failed to get render_graphics tool from registry');
    process.exit(1);
  }

  // Create output directory
  const outputDir = join(cwd, 'graphics-tests');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Test 1: Mermaid rendering to PNG and SVG
  console.log('\n--- Test 1: Mermaid Rendering ---');
  const mermaidCode = `graph TD
    A[Start] --> B(First Process)
    B --> C{Decision}
    C -->|Yes| D[Success]
    C -->|No| E[Fail]`;

  try {
    const resPng = await registry.execute('render_graphics', {
      type: 'mermaid',
      code: mermaidCode,
      outputPath: 'graphics-tests/mermaid.png',
      width: 800,
      height: 600,
      backgroundColor: '#f5f5f7'
    });
    console.log('Mermaid to PNG Result:', resPng);

    const resSvg = await registry.execute('render_graphics', {
      type: 'mermaid',
      code: mermaidCode,
      outputPath: 'graphics-tests/mermaid.svg',
      width: 800,
      height: 600,
      backgroundColor: '#f5f5f7'
    });
    console.log('Mermaid to SVG Result:', resSvg);
  } catch (err) {
    console.error('❌ Test 1 failed:', err);
  }

  // Test 2: SVG rendering to PNG and SVG
  console.log('\n--- Test 2: SVG Rendering ---');
  const svgCode = `<svg width="400" height="200" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="15"/>
  <circle cx="100" cy="100" r="50" fill="#f38ba8"/>
  <circle cx="200" cy="100" r="50" fill="#a6e3a1"/>
  <circle cx="300" cy="100" r="50" fill="#89b4fa"/>
  <text x="50%" y="30" dominant-baseline="middle" text-anchor="middle" fill="#cdd6f4" font-family="sans-serif" font-size="20">SVG Rendering Test</text>
</svg>`;

  try {
    const resPng = await registry.execute('render_graphics', {
      type: 'svg',
      code: svgCode,
      outputPath: 'graphics-tests/svg_test.png',
      width: 500,
      height: 300,
      backgroundColor: '#11111b'
    });
    console.log('SVG to PNG Result:', resPng);

    const resSvg = await registry.execute('render_graphics', {
      type: 'svg',
      code: svgCode,
      outputPath: 'graphics-tests/svg_test.svg',
      width: 500,
      height: 300,
      backgroundColor: '#11111b'
    });
    console.log('SVG to SVG Result:', resSvg);
  } catch (err) {
    console.error('❌ Test 2 failed:', err);
  }

  // Test 3: HTML5 Canvas rendering to PNG
  console.log('\n--- Test 3: HTML5 Canvas Rendering ---');
  const canvasCode = `// Draw a beautiful gradient arc/circle
const gradient = ctx.createLinearGradient(0, 0, 800, 600);
gradient.addColorStop(0, '#ff7b00');
gradient.addColorStop(1, '#ff007b');
ctx.fillStyle = gradient;
ctx.beginPath();
ctx.arc(400, 300, 150, 0, Math.PI * 2);
ctx.fill();

// Draw some glowing text
ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
ctx.shadowBlur = 10;
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 36px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('Canvas Rendering Test', 400, 310);`;

  try {
    const resPng = await registry.execute('render_graphics', {
      type: 'canvas',
      code: canvasCode,
      outputPath: 'graphics-tests/canvas.png',
      width: 800,
      height: 600,
      backgroundColor: '#121214'
    });
    console.log('Canvas to PNG Result:', resPng);
  } catch (err) {
    console.error('❌ Test 3 failed:', err);
  }

  console.log('\n🏁 Verification tests complete!');
}

runTests();
