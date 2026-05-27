/**
 * 🌍 NOVA Arabic Shaper & Bidirectional (BiDi) Layout Engine
 * Zero-dependency, high-performance, and fully compatible with ANSI escape sequences.
 */

// Unicode range for Arabic characters
export function isArabicChar(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return (
    (code >= 0x0600 && code <= 0x06FF) || // Arabic block
    (code >= 0x0750 && code <= 0x077F) || // Arabic Supplement
    (code >= 0x08A0 && code <= 0x08FF) || // Arabic Extended-A
    (code >= 0xFB50 && code <= 0xFDFF) || // Arabic Presentation Forms-A
    (code >= 0xFE70 && code <= 0xFEFF)    // Arabic Presentation Forms-B
  );
}

interface ArabicCharDef {
  code: number;
  isolated: string;
  final: string;
  initial?: string;
  medial?: string;
  connectsLeft: boolean;
}

// Map of Arabic characters to their presentation forms (Isolated, Final, Initial, Medial)
// and whether they connect to the left.
const ARABIC_MAP: Record<number, ArabicCharDef> = {
  0x0621: { code: 0x0621, isolated: '\uFE80', final: '\uFE80', connectsLeft: false }, // ء
  0x0622: { code: 0x0622, isolated: '\uFE81', final: '\uFE82', connectsLeft: false }, // آ
  0x0623: { code: 0x0623, isolated: '\uFE83', final: '\uFE84', connectsLeft: false }, // أ
  0x0624: { code: 0x0624, isolated: '\uFE85', final: '\uFE86', connectsLeft: false }, // ؤ
  0x0625: { code: 0x0625, isolated: '\uFE87', final: '\uFE88', connectsLeft: false }, // إ
  0x0626: { code: 0x0626, isolated: '\uFE89', final: '\uFE8A', initial: '\uFE8B', medial: '\uFE8C', connectsLeft: true }, // ئ
  0x0627: { code: 0x0627, isolated: '\uFE8D', final: '\uFE8E', connectsLeft: false }, // ا
  0x0628: { code: 0x0628, isolated: '\uFE8F', final: '\uFE90', initial: '\uFE91', medial: '\uFE92', connectsLeft: true }, // ب
  0x0629: { code: 0x0629, isolated: '\uFE93', final: '\uFE94', connectsLeft: false }, // ة
  0x062A: { code: 0x062A, isolated: '\uFE95', final: '\uFE96', initial: '\uFE97', medial: '\uFE98', connectsLeft: true }, // ت
  0x062B: { code: 0x062B, isolated: '\uFE99', final: '\uFE9A', initial: '\uFE9B', medial: '\uFE9C', connectsLeft: true }, // ث
  0x062C: { code: 0x062C, isolated: '\uFE9D', final: '\uFE9E', initial: '\uFE9F', medial: '\uFEA0', connectsLeft: true }, // ج
  0x062D: { code: 0x062D, isolated: '\uFEA1', final: '\uFEA2', initial: '\uFEA3', medial: '\uFEA4', connectsLeft: true }, // ح
  0x062E: { code: 0x062E, isolated: '\uFEA5', final: '\uFEA6', initial: '\uFEA7', medial: '\uFEA8', connectsLeft: true }, // خ
  0x062F: { code: 0x062F, isolated: '\uFEA9', final: '\uFEAA', connectsLeft: false }, // د
  0x0630: { code: 0x0630, isolated: '\uFEAB', final: '\uFEAC', connectsLeft: false }, // ذ
  0x0631: { code: 0x0631, isolated: '\uFEAD', final: '\uFEAE', connectsLeft: false }, // ر
  0x0632: { code: 0x0632, isolated: '\uFEAF', final: '\uFEB0', connectsLeft: false }, // ز
  0x0633: { code: 0x0633, isolated: '\uFEB1', final: '\uFEB2', initial: '\uFEB3', medial: '\uFEB4', connectsLeft: true }, // س
  0x0634: { code: 0x0634, isolated: '\uFEB5', final: '\uFEB6', initial: '\uFEB7', medial: '\uFEB8', connectsLeft: true }, // ش
  0x0635: { code: 0x0635, isolated: '\uFEB9', final: '\uFEBA', initial: '\uFEBB', medial: '\uFEBC', connectsLeft: true }, // ص
  0x0636: { code: 0x0636, isolated: '\uFEBD', final: '\uFEBE', initial: '\uFEBF', medial: '\uFEC0', connectsLeft: true }, // ض
  0x0637: { code: 0x0637, isolated: '\uFEC1', final: '\uFEC2', initial: '\uFEC3', medial: '\uFEC4', connectsLeft: true }, // ط
  0x0638: { code: 0x0638, isolated: '\uFEC5', final: '\uFEC6', initial: '\uFEC7', medial: '\uFEC8', connectsLeft: true }, // ظ
  0x0639: { code: 0x0639, isolated: '\uFEC9', final: '\uFECA', initial: '\uFECB', medial: '\uFECC', connectsLeft: true }, // ع
  0x063A: { code: 0x063A, isolated: '\uFECD', final: '\uFECE', initial: '\uFECF', medial: '\uFED0', connectsLeft: true }, // غ
  0x0641: { code: 0x0641, isolated: '\uFED1', final: '\uFED2', initial: '\uFED3', medial: '\uFED4', connectsLeft: true }, // ف
  0x0642: { code: 0x0642, isolated: '\uFED5', final: '\uFED6', initial: '\uFED7', medial: '\uFED8', connectsLeft: true }, // ق
  0x0643: { code: 0x0643, isolated: '\uFED9', final: '\uFEDA', initial: '\uFEDB', medial: '\uFEDC', connectsLeft: true }, // ك
  0x0644: { code: 0x0644, isolated: '\uFEDD', final: '\uFEDE', initial: '\uFEDF', medial: '\uFEE0', connectsLeft: true }, // ل
  0x0645: { code: 0x0645, isolated: '\uFEE1', final: '\uFEE2', initial: '\uFEE3', medial: '\uFEE4', connectsLeft: true }, // م
  0x0646: { code: 0x0646, isolated: '\uFEE5', final: '\uFEE6', initial: '\uFEE7', medial: '\uFEE8', connectsLeft: true }, // ن
  0x0647: { code: 0x0647, isolated: '\uFEE9', final: '\uFEEA', initial: '\uFEEB', medial: '\uFEEC', connectsLeft: true }, // ه
  0x0648: { code: 0x0648, isolated: '\uFEED', final: '\uFEEE', connectsLeft: false }, // و
  0x0649: { code: 0x0649, isolated: '\uFEEF', final: '\uFEF0', connectsLeft: false }, // ى
  0x064A: { code: 0x064A, isolated: '\uFEF1', final: '\uFEF2', initial: '\uFEF3', medial: '\uFEF4', connectsLeft: true }, // ي

  // Persian/Urdu characters support
  0x067E: { code: 0x067E, isolated: '\uFB56', final: '\uFB57', initial: '\uFB58', medial: '\uFB59', connectsLeft: true }, // پ
  0x0686: { code: 0x0686, isolated: '\uFB7A', final: '\uFB7B', initial: '\uFB7C', medial: '\uFB7D', connectsLeft: true }, // چ
  0x0698: { code: 0x0698, isolated: '\uFB8A', final: '\uFB8B', connectsLeft: false }, // ژ
  0x06AF: { code: 0x06AF, isolated: '\uFB92', final: '\uFB93', initial: '\uFB94', medial: '\uFB95', connectsLeft: true }, // گ
  0x06A9: { code: 0x06A9, isolated: '\uFB8E', final: '\uFB8F', initial: '\uFB90', medial: '\uFB91', connectsLeft: true }, // ک
  0x06CC: { code: 0x06CC, isolated: '\uFEEF', final: '\uFEF0', initial: '\uFEF3', medial: '\uFEF4', connectsLeft: true }  // ی
};

/** Shape a contiguous run of Arabic characters */
export function shapeArabicRun(text: string): string {
  let result = '';
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);

    // ── Handle Lam-Alef Ligatures ────────────────────────────────────
    if (code === 0x0644 && i + 1 < len) {
      const nextCode = text.charCodeAt(i + 1);
      let ligature: string | null = null;

      // Check if previous char connects to this Lam
      const connectsRight = i > 0 && isArabicChar(text[i - 1]) && ARABIC_MAP[text.charCodeAt(i - 1)]?.connectsLeft;

      if (nextCode === 0x0622) ligature = connectsRight ? '\uFEF6' : '\uFEF5';      // لآ
      else if (nextCode === 0x0623) ligature = connectsRight ? '\uFEF8' : '\uFEF7'; // لأ
      else if (nextCode === 0x0625) ligature = connectsRight ? '\uFEFA' : '\uFEF9'; // لإ
      else if (nextCode === 0x0627) ligature = connectsRight ? '\uFEFC' : '\uFEFB'; // لا

      if (ligature) {
        result += ligature;
        i++; // skip the Alef
        continue;
      }
    }

    const def = ARABIC_MAP[code];
    if (def) {
      const connectsRight = i > 0 && isArabicChar(text[i - 1]) && ARABIC_MAP[text.charCodeAt(i - 1)]?.connectsLeft;
      const connectsLeft = i + 1 < len && isArabicChar(text[i + 1]) && ARABIC_MAP[text.charCodeAt(i + 1)]?.code !== undefined;

      if (connectsRight && connectsLeft && def.medial) {
        result += def.medial;
      } else if (connectsRight && def.final) {
        result += def.final;
      } else if (connectsLeft && def.initial) {
        result += def.initial;
      } else {
        result += def.isolated;
      }
    } else {
      result += char;
    }
  }

  return result;
}

/** Reverse shaped run while leaving numbers and English words inside LTR */
export function reverseArabicRun(text: string): string {
  const shaped = shapeArabicRun(text);

  const tokens: { type: 'RTL' | 'LTR'; value: string }[] = [];
  let currentType: 'RTL' | 'LTR' | null = null;
  let currentVal = '';

  for (let i = 0; i < shaped.length; i++) {
    const char = shaped[i];
    const code = char.charCodeAt(0);

    // Digits (Latin & Arabic-Indic) and English letters are LTR
    const isDigit = (code >= 0x0030 && code <= 0x0039) || (code >= 0x0660 && code <= 0x0669);
    const isEng = (code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A);

    const isLtrChar = isDigit || isEng;
    const type = isLtrChar ? 'LTR' : 'RTL';

    if (currentType === null) {
      currentType = type;
      currentVal = char;
    } else if (currentType === type) {
      currentVal += char;
    } else {
      tokens.push({ type: currentType, value: currentVal });
      currentType = type;
      currentVal = char;
    }
  }
  if (currentVal) {
    tokens.push({ type: currentType!, value: currentVal });
  }

  // Reverse characters of RTL blocks, keep LTR blocks as-is, then reverse the entire tokens array
  const processedTokens = tokens.map(tok => {
    if (tok.type === 'RTL') {
      return tok.value.split('').reverse().join('');
    } else {
      return tok.value;
    }
  });

  return processedTokens.reverse().join('');
}

/**
 * Main parser: shapes and reverses Arabic runs in a string while perfectly 
 * preserving ANSI escape sequences, markdown, bullet markers, and English text.
 */
export function applyArabicRendering(text: string): string {
  if (!text) return text;

  // Detect if there's any Arabic in the text before running the heavy parser
  let hasArabic = false;
  for (let i = 0; i < text.length; i++) {
    if (isArabicChar(text[i])) {
      hasArabic = true;
      break;
    }
  }
  if (!hasArabic) return text;

  // 1. Extract ANSI escape codes into placeholders
  const ansiMatches: string[] = [];
  const textWithPlaceholders = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, (match) => {
    ansiMatches.push(match);
    return `\uF000_${ansiMatches.length - 1}_\uF000`;
  });

  const chars = textWithPlaceholders.split('');
  const len = chars.length;

  const isArabicCharOrNeutral = (i: number): boolean => {
    const c = chars[i];
    if (!c) return false;
    if (c === '\uF000') return false;

    const code = c.charCodeAt(0);
    // Is it strictly Arabic?
    if (isArabicChar(c)) return true;

    // Is it neutral/number inside or next to Arabic?
    const isNeutral =
      (code >= 0x0030 && code <= 0x0039) || // 0-9
      code === 0x0020 ||                   // space
      code === 0x0660 || code === 0x0669 || // Arabic digits
      [
        0x060C, 0x061F, 0x061B, // Arabic punctuation (، ؟ ؛)
        0x002E, 0x002C, 0x0021, 0x003F, 0x003A, 0x002D, // . , ! ? : -
        0x0028, 0x0029, 0x005B, 0x005D, 0x002A          // ( ) [ ] *
      ].includes(code);

    return isNeutral;
  };

  const isStrictlyArabic = (c: string): boolean => {
    if (!c) return false;
    return isArabicChar(c);
  };

  // Group characters into LTR and RTL runs
  const runs: { type: 'RTL' | 'LTR'; value: string }[] = [];
  let currentRun = '';
  let currentType: 'RTL' | 'LTR' = 'LTR';

  for (let i = 0; i < len; i++) {
    const char = chars[i];

    if (isArabicCharOrNeutral(i)) {
      let hasStrictArabic = false;
      if (currentType === 'RTL') {
        hasStrictArabic = true;
      } else {
        // Look forward in the neutral block to see if it leads to actual Arabic
        let j = i;
        while (j < len && isArabicCharOrNeutral(j)) {
          if (isStrictlyArabic(chars[j])) {
            hasStrictArabic = true;
            break;
          }
          j++;
        }
      }

      if (hasStrictArabic) {
        if (currentType === 'RTL') {
          currentRun += char;
        } else {
          if (currentRun) runs.push({ type: 'LTR', value: currentRun });
          currentRun = char;
          currentType = 'RTL';
        }
        continue;
      }
    }

    if (currentType === 'LTR') {
      currentRun += char;
    } else {
      if (currentRun) runs.push({ type: 'RTL', value: currentRun });
      currentRun = char;
      currentType = 'LTR';
    }
  }

  if (currentRun) {
    runs.push({ type: currentType, value: currentRun });
  }

  // Process and re-assemble
  const processedRuns = runs.map(run => {
    if (run.type === 'RTL') {
      return reverseArabicRun(run.value);
    } else {
      return run.value;
    }
  });

  let finalResult = processedRuns.join('');
  
  // Restore ANSI escape codes from placeholders
  finalResult = finalResult.replace(/\uF000_(\d+)_\uF000/g, (_, indexStr) => {
    const idx = parseInt(indexStr, 10);
    return ansiMatches[idx] || '';
  });

  return finalResult;
}
