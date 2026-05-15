/**
 * 🎨 NOVA Design System — Cyberpunk Theme Engine
 * Advanced terminal theming with gradient support, multiple palettes,
 * and semantic color tokens.
 */

import chalk, { type ChalkInstance } from 'chalk';

// ─── Color Palettes ──────────────────────────────────────────────────────────

export interface ColorPalette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  bg: string;
  bgAlt: string;
  text: string;
  textDim: string;
  border: string;
  gradient: string[];
}

export const PALETTES: Record<string, ColorPalette> = {
  cyberpunk: {
    name: 'Cyberpunk',
    primary: '#00FFFF',    // Cyan
    secondary: '#FF00FF',  // Magenta
    accent: '#BF40BF',     // Purple
    success: '#00FF88',
    warning: '#FFD700',
    error: '#FF3366',
    info: '#00BFFF',
    muted: '#6C7086',
    bg: '#0D1117',
    bgAlt: '#161B22',
    text: '#E6EDF3',
    textDim: '#7D8590',
    border: '#30363D',
    gradient: ['#00FFFF', '#00BFFF', '#8B5CF6', '#FF00FF'],
  },
  nord: {
    name: 'Nord',
    primary: '#88C0D0',
    secondary: '#81A1C1',
    accent: '#B48EAD',
    success: '#A3BE8C',
    warning: '#EBCB8B',
    error: '#BF616A',
    info: '#5E81AC',
    muted: '#4C566A',
    bg: '#2E3440',
    bgAlt: '#3B4252',
    text: '#ECEFF4',
    textDim: '#D8DEE9',
    border: '#434C5E',
    gradient: ['#88C0D0', '#81A1C1', '#5E81AC', '#B48EAD'],
  },
  dracula: {
    name: 'Dracula',
    primary: '#BD93F9',
    secondary: '#FF79C6',
    accent: '#8BE9FD',
    success: '#50FA7B',
    warning: '#F1FA8C',
    error: '#FF5555',
    info: '#6272A4',
    muted: '#44475A',
    bg: '#282A36',
    bgAlt: '#44475A',
    text: '#F8F8F2',
    textDim: '#6272A4',
    border: '#6272A4',
    gradient: ['#BD93F9', '#FF79C6', '#8BE9FD', '#50FA7B'],
  },
  matrix: {
    name: 'Matrix',
    primary: '#00FF41',
    secondary: '#008F11',
    accent: '#00FF41',
    success: '#00FF41',
    warning: '#FFFF00',
    error: '#FF0000',
    info: '#00FF41',
    muted: '#003B00',
    bg: '#0D0208',
    bgAlt: '#003B00',
    text: '#00FF41',
    textDim: '#008F11',
    border: '#008F11',
    gradient: ['#00FF41', '#00CC33', '#009926', '#006619'],
  },
  sunset: {
    name: 'Sunset',
    primary: '#FF6B6B',
    secondary: '#FFA07A',
    accent: '#FFD93D',
    success: '#6BCB77',
    warning: '#FFD93D',
    error: '#FF4757',
    info: '#74B9FF',
    muted: '#636E72',
    bg: '#1A1A2E',
    bgAlt: '#16213E',
    text: '#EAEAEA',
    textDim: '#A4B0BD',
    border: '#0F3460',
    gradient: ['#FF6B6B', '#FFA07A', '#FFD93D', '#6BCB77'],
  },
};

// ─── Theme State ─────────────────────────────────────────────────────────────

let currentPalette: ColorPalette = PALETTES.cyberpunk;

export function setTheme(name: string): void {
  const palette = PALETTES[name.toLowerCase()];
  if (palette) {
    currentPalette = palette;
  }
}

export function getTheme(): ColorPalette {
  return currentPalette;
}

export function getThemeNames(): string[] {
  return Object.keys(PALETTES);
}

// ─── Semantic Color Functions ────────────────────────────────────────────────

export const colors = {
  primary: (text: string) => chalk.hex(currentPalette.primary)(text),
  secondary: (text: string) => chalk.hex(currentPalette.secondary)(text),
  accent: (text: string) => chalk.hex(currentPalette.accent)(text),
  success: (text: string) => chalk.hex(currentPalette.success)(text),
  warning: (text: string) => chalk.hex(currentPalette.warning)(text),
  error: (text: string) => chalk.hex(currentPalette.error)(text),
  info: (text: string) => chalk.hex(currentPalette.info)(text),
  muted: (text: string) => chalk.hex(currentPalette.muted)(text),
  text: (text: string) => chalk.hex(currentPalette.text)(text),
  textDim: (text: string) => chalk.hex(currentPalette.textDim)(text),
  bold: (text: string) => chalk.bold(text),
  italic: (text: string) => chalk.italic(text),
  underline: (text: string) => chalk.underline(text),
  strikethrough: (text: string) => chalk.strikethrough(text),
  dim: (text: string) => chalk.dim(text),
};

// ─── Gradient Text Rendering ─────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [255, 255, 255];
}

function interpolateColor(
  color1: [number, number, number],
  color2: [number, number, number],
  factor: number
): [number, number, number] {
  return [
    Math.round(color1[0] + factor * (color2[0] - color1[0])),
    Math.round(color1[1] + factor * (color2[1] - color1[1])),
    Math.round(color1[2] + factor * (color2[2] - color1[2])),
  ];
}

export function gradient(text: string, gradientColors?: string[]): string {
  const colorsToUse = gradientColors || currentPalette.gradient;
  const chars = [...text];
  const totalChars = chars.length;
  if (totalChars === 0) return '';
  if (totalChars === 1) return chalk.hex(colorsToUse[0])(text);

  const rgbColors = colorsToUse.map(hexToRgb);
  const segments = rgbColors.length - 1;

  return chars
    .map((char, i) => {
      if (char === ' ') return ' ';
      const position = i / (totalChars - 1);
      const segmentIndex = Math.min(Math.floor(position * segments), segments - 1);
      const segmentPosition = (position * segments) - segmentIndex;
      const [r, g, b] = interpolateColor(
        rgbColors[segmentIndex],
        rgbColors[segmentIndex + 1],
        segmentPosition
      );
      return chalk.rgb(r, g, b)(char);
    })
    .join('');
}

// ─── Box Drawing ─────────────────────────────────────────────────────────────

export const BOX = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  teeRight: '├',
  teeLeft: '┤',
  teeDown: '┬',
  teeUp: '┴',
  cross: '┼',

  // Double
  dTopLeft: '╔',
  dTopRight: '╗',
  dBottomLeft: '╚',
  dBottomRight: '╝',
  dHorizontal: '═',
  dVertical: '║',

  // Heavy
  hTopLeft: '┏',
  hTopRight: '┓',
  hBottomLeft: '┗',
  hBottomRight: '┛',
  hHorizontal: '━',
  hVertical: '┃',
};

// ─── Unicode Symbols ─────────────────────────────────────────────────────────

export const ICONS = {
  nova: '◆',
  user: '❯',
  success: '✔',
  error: '✖',
  warning: '⚠',
  info: 'ℹ',
  arrow: '→',
  arrowRight: '▸',
  arrowDown: '▾',
  bullet: '●',
  circle: '○',
  star: '★',
  lightning: '⚡',
  gear: '⚙',
  plug: '🔌',
  brain: '🧠',
  tool: '🔧',
  file: '📄',
  folder: '📁',
  search: '🔍',
  clock: '⏱',
  save: '💾',
  trash: '🗑',
  lock: '🔒',
  unlock: '🔓',
  rocket: '🚀',
  fire: '🔥',
  sparkle: '✨',
  check: '☑',
  cross: '☒',
  dot: '·',
  ellipsis: '…',
  pipe: '│',
  dash: '─',
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
};

// ─── Layout Helpers ──────────────────────────────────────────────────────────

export function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

export function getTerminalHeight(): number {
  return process.stdout.rows || 24;
}

export function horizontalLine(char = BOX.horizontal, width?: number): string {
  const w = width || getTerminalWidth();
  return chalk.hex(currentPalette.border)(char.repeat(w));
}

export function centeredText(text: string, width?: number): string {
  const w = width || getTerminalWidth();
  const stripAnsiImport = text.replace(/\x1b\[[0-9;]*m/g, '');
  const padding = Math.max(0, Math.floor((w - stripAnsiImport.length) / 2));
  return ' '.repeat(padding) + text;
}

export function rightAligned(text: string, width?: number): string {
  const w = width || getTerminalWidth();
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  const padding = Math.max(0, w - stripped.length);
  return ' '.repeat(padding) + text;
}

// ─── Box Component ───────────────────────────────────────────────────────────

export interface BoxOptions {
  title?: string;
  width?: number;
  padding?: number;
  borderColor?: string;
  titleColor?: string;
  style?: 'rounded' | 'double' | 'heavy' | 'single';
}

export function box(content: string, options: BoxOptions = {}): string {
  const {
    title,
    width = Math.min(getTerminalWidth() - 4, 80),
    padding = 1,
    borderColor = currentPalette.border,
    titleColor = currentPalette.primary,
    style = 'rounded',
  } = options;

  const bc = chalk.hex(borderColor);
  let tl: string, tr: string, bl: string, br: string, h: string, v: string;

  switch (style) {
    case 'double':
      [tl, tr, bl, br, h, v] = [BOX.dTopLeft, BOX.dTopRight, BOX.dBottomLeft, BOX.dBottomRight, BOX.dHorizontal, BOX.dVertical];
      break;
    case 'heavy':
      [tl, tr, bl, br, h, v] = [BOX.hTopLeft, BOX.hTopRight, BOX.hBottomLeft, BOX.hBottomRight, BOX.hHorizontal, BOX.hVertical];
      break;
    default:
      [tl, tr, bl, br, h, v] = [BOX.topLeft, BOX.topRight, BOX.bottomLeft, BOX.bottomRight, BOX.horizontal, BOX.vertical];
  }

  const innerWidth = width - 2;
  const pad = ' '.repeat(padding);

  // Top border
  let topBorder: string;
  if (title) {
    const titleStr = ` ${chalk.hex(titleColor).bold(title)} `;
    const titleStripped = title.length + 2;
    const remainingWidth = innerWidth - titleStripped - 2;
    const leftLine = h.repeat(2);
    const rightLine = h.repeat(Math.max(0, remainingWidth));
    topBorder = bc(`${tl}${leftLine}`) + titleStr + bc(`${rightLine}${tr}`);
  } else {
    topBorder = bc(`${tl}${h.repeat(innerWidth)}${tr}`);
  }

  // Bottom border
  const bottomBorder = bc(`${bl}${h.repeat(innerWidth)}${br}`);

  // Content lines
  const lines = content.split('\n');
  const contentLines = lines.map((line) => {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    const available = innerWidth - padding * 2;
    const truncated = stripped.length > available ? line.slice(0, available) : line;
    const strippedTrunc = truncated.replace(/\x1b\[[0-9;]*m/g, '');
    const rightPad = Math.max(0, available - strippedTrunc.length);
    return `${bc(v)}${pad}${truncated}${' '.repeat(rightPad)}${pad}${bc(v)}`;
  });

  return [topBorder, ...contentLines, bottomBorder].join('\n');
}

// ─── Badge / Tag Component ───────────────────────────────────────────────────

export function badge(text: string, color?: string): string {
  const c = color || currentPalette.primary;
  return chalk.bgHex(c).hex('#000000').bold(` ${text} `);
}

export function tag(label: string, value: string, labelColor?: string): string {
  const lc = labelColor || currentPalette.muted;
  return `${chalk.hex(lc)(label)} ${chalk.hex(currentPalette.text)(value)}`;
}

// ─── Status Indicators ──────────────────────────────────────────────────────

export function statusDot(status: 'online' | 'offline' | 'busy' | 'idle'): string {
  const colorMap = {
    online: currentPalette.success,
    offline: currentPalette.error,
    busy: currentPalette.warning,
    idle: currentPalette.muted,
  };
  return chalk.hex(colorMap[status])('●');
}

// ─── NOVA Logo ───────────────────────────────────────────────────────────────

export const LOGO = `
  ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ 
  ████╗  ██║██╔═══██╗██║   ██║██╔══██╗
  ██╔██╗ ██║██║   ██║██║   ██║███████║
  ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║
  ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║
  ╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝`;

export const LOGO_SMALL = `◆ NOVA`;

export function renderLogo(): string {
  return gradient(LOGO);
}

export function renderTagline(): string {
  return centeredText(
    chalk.hex(currentPalette.textDim)('Next-gen Orchestrated Virtual Assistant') +
    chalk.hex(currentPalette.muted)(' — Powered by Ollama')
  );
}
