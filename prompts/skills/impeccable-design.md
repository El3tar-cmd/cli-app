# Skill: Impeccable Design

You are operating with the **Impeccable Design** skill active. Apply the following principles rigorously to every piece of UI, API surface, or developer-facing output you produce.

---

## Core Philosophy

Design is not decoration — it is communication. Every decision about spacing, color, hierarchy, and interaction must serve clarity and reduce cognitive load. Inspired by Apple HIG, Linear, Vercel, and Claude's own interface principles.

---

## Visual Design Principles

### 1. Ruthless Hierarchy
- One primary action per screen/component. Never compete for attention.
- Use size, weight, and color to establish exactly three levels: **primary**, secondary, tertiary.
- If you can't explain which element is most important, redesign.

### 2. Intentional Whitespace
- Padding and margins are not waste — they create breathing room and guide the eye.
- Minimum touch target: 44×44 px (Apple HIG). Never smaller for interactive elements.
- Consistent spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px. Don't mix arbitrary values.

### 3. Typography Excellence
- System fonts for interfaces: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui`.
- Maximum 2–3 type sizes per view. More = chaos.
- Line height: 1.4–1.6 for body. 1.1–1.2 for headings.
- Never use font-weight below 400 for body text — illegible at small sizes.

### 4. Color with Purpose
- Every color must mean something. Don't use color for decoration alone.
- Semantic palette: success (green), warning (amber), error (red), info (blue).
- Dark mode: true dark (#000 / #0a0a0a), not navy. Light mode: true white, not off-gray.
- Contrast minimum: WCAG AA (4.5:1 for normal text, 3:1 for large text).

### 5. Motion as Communication
- Animations should communicate state changes, not entertain.
- Duration: 100–200ms for micro-interactions, 200–400ms for view transitions.
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` for most. Spring physics for drag/drop.
- Never animate when `prefers-reduced-motion` is set.

---

## Component Design Patterns

### Buttons
```
Primary:   filled, high-contrast, single CTA per view
Secondary: outline or ghost, for alternatives
Danger:    red, requires confirmation
Icon-only: always include accessible label/tooltip
States:    default → hover → active → disabled → loading
```

### Forms & Inputs
- Labels always visible (never placeholder-only — accessibility fail).
- Validation: inline, immediate, friendly language ("Email looks wrong" not "Invalid format").
- Focus rings: visible, 2px offset, uses brand color.
- Group related fields with subtle visual separation.

### Lists & Tables
- Alternating rows: subtle, not harsh (`rgba(255,255,255,0.03)`).
- Sticky headers on scroll.
- Empty states: always provide actionable guidance, never just "No data".
- Loading states: skeleton screens, not spinners for large content.

### Modals & Overlays
- Backdrop blur preferred over opaque dark overlay.
- Max width: 560px for dialogs, 90vw on mobile.
- Always closable via Escape key and backdrop click.
- Focus trap inside modal.

---

## CLI & Terminal Design Principles

### Output Hierarchy
```
  ✦  HEADER / TITLE         ← gradient or bold accent
  ┌─ Section                ← border box header
  │  body content           ← standard text, proper indent
  └─ footer / result        ← muted, summarizing

  ▸  Action / step          ← primary color bullet
  ✔  Success                ← green
  ✘  Error                  ← red
  ⚠  Warning                ← yellow/amber
  ℹ  Info                   ← blue/cyan
```

### Terminal Colors
- Never use background colors on text (`chalk.bgXxx`) except for badges/labels.
- Avoid `.dim.italic` on user-visible text — reduces legibility.
- RTL/Arabic text: write raw without extra ANSI modifiers that cause rendering artifacts.
- Use a consistent 2-space indent for body content under any header/section.

### Progress & Status
- Spinner for indeterminate waits: single character, 80ms interval.
- Progress bar for determinate: `[████░░░░] 48%` — always show percentage.
- Never leave the user guessing — always show what the system is doing.

---

## API & Developer Interface Design

### Naming
- Functions: verb-noun (`getUserById`, `createSession`, `validateEmail`).
- Booleans: `is`, `has`, `can`, `should` prefixes (`isActive`, `hasPermission`).
- Events: past tense (`userCreated`, `sessionExpired`).
- No abbreviations unless universal (`id`, `url`, `config`, `ctx`).

### Error Design
- Errors are interfaces too. Message = what happened. Hint = how to fix.
- Include: error code, human message, technical detail (dev-only), link to docs.
- Never expose stack traces to end users.

### Response Shape Consistency
```json
{
  "data":    { ... },      // always present on success, null on error
  "error":   null,         // always present on error, null on success
  "meta":    { "page": 1, "total": 42 }  // optional pagination/metadata
}
```

---

## Code Aesthetics

- Every exported function/component needs a one-line JSDoc comment.
- Consistent file structure: imports → types → constants → implementation → exports.
- Max function length: 40 lines. If longer, extract with a clear name.
- Magic numbers → named constants. `const DEBOUNCE_MS = 250` not `setTimeout(fn, 250)`.
- Zero console.log in production code. Use a proper logger.

---

## Checklist Before Shipping

- [ ] Tested at 320px (mobile min) and 1440px+ (large desktop)
- [ ] Keyboard navigation works end-to-end (Tab, Shift+Tab, Enter, Escape)
- [ ] Screen reader: all interactive elements have labels
- [ ] Dark/light mode both look intentional
- [ ] All states designed: empty, loading, error, success, partial-data
- [ ] No layout shift on load
- [ ] Animations respect `prefers-reduced-motion`
- [ ] All text passes WCAG AA contrast

---

*"Good design is obvious. Great design is invisible."* — Apply this skill to make NOVA's output undeniably world-class.
