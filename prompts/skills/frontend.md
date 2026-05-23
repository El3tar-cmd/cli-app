# 🎨 Frontend, UX/UI, Design Systems & AI-Native Interfaces (2026 Edition)

> Skills for building professional, accessible, performant, and AI-augmented user interfaces.

## React & Next.js (2026 Standards)

### React Compiler Era
- **Trust the React Compiler** — manual `useMemo`, `useCallback`, `React.memo` are now legacy. The compiler handles re-render optimization at build time.
- Write **clean, straightforward component logic** without micro-optimizing.
- Use **React Server Components (RSC)** as the default. Client Components only for interactivity.
- **Server Actions** for form handling and mutations — replaces API route boilerplate entirely.

### Next.js App Router
- App Router is the standard. Use `app/` directory with layouts, loading states, and error boundaries.
- Default to **streaming** and **Suspense** for progressive page loading.
- Use `generateMetadata()` for SEO, `generateStaticParams()` for static pre-rendering.
- **Parallel Routes** and **Intercepting Routes** for modal patterns and complex UI.

### TypeScript (Non-Negotiable)
- Enable `strict: true` in all projects.
- Use **discriminated unions** for state machine-style component states.
- Use `satisfies` operator for type-safe object literals.
- Validate all API responses with **Zod** before rendering.

---

## Modern CSS (2026 — The CSS Renaissance)

### Layout
- **CSS Grid** for macro-layouts (page skeletons, dashboards, card grids).
- **Flexbox** for micro-layouts (component internals, toolbars, nav items).
- **Container Queries** (`@container`) — components adapt to parent size. Replaces most media queries.

### Native CSS Power Features
| Feature | Replaces |
|---------|----------|
| `@container` queries | JS-based responsive components |
| `:has()` selector | Parent selectors (impossible before) |
| Native CSS Nesting | SCSS/LESS nesting syntax |
| `@layer` (Cascade Layers) | Specificity hacks and `!important` wars |
| `oklch()` color space | HSL and limited color gamuts |
| `@starting-style` | JS-based enter animations |
| Scroll-driven animations | IntersectionObserver for scroll effects |
| View Transitions API | JS page transition libraries |
| `text-box-trim` | Whitespace / line-height hacks |

### Design Tokens
- Define ALL tokens as CSS custom properties: colors, spacing, radii, shadows, typography.
- Use `oklch()` for perceptually uniform, accessible color palettes.
- Support light/dark themes via `prefers-color-scheme` + CSS custom properties natively.

---

## AI UI Components & Patterns (2026)

### Streaming Text Rendering
```typescript
// Standard pattern for streaming AI responses in React
function StreamingResponse({ stream }: { stream: AsyncIterable<string> }) {
  const [text, setText] = useState('');

  useEffect(() => {
    let buffer = '';
    const reader = async () => {
      for await (const chunk of stream) {
        buffer += chunk;
        setText(buffer); // Update on each token — smooth streaming
      }
    };
    reader();
  }, [stream]);

  return <Markdown>{text}</Markdown>;
}
```

### AI-Native Interface Patterns
- **Progressive disclosure**: Show results as they stream — don't wait for completion.
- **Abort control**: Every AI request must have a visible cancel button with `AbortController`.
- **Confidence indicators**: Show model uncertainty visually (e.g. color, opacity, tooltips).
- **Skeleton states**: Use animated skeletons while AI generates structured output.
- **Diff views**: Show AI-suggested changes as visual diffs (before/after), not replacements.
- **Undo/redo for AI actions**: Users must be able to reverse any AI-applied change.

### Agent Activity UI
- **Live task tree**: Show running subagents, their status, and completion.
- **Tool call log**: Expandable list of every tool call with inputs and outputs.
- **Token budget meter**: Visual progress bar for context window usage.
- **Thinking indicator**: Differentiate "thinking" (no output yet) from "responding" (streaming).

---

## UX/UI Design Principles (2026)

- **AI-Driven Adaptation** — interfaces dynamically reorganize based on user behavior and intent.
- **Motion with Meaning** — animations guide attention and reduce cognitive load.
- **Functional Minimalism** — reduce friction and visual noise as features increase.
- **Progressive Disclosure** — show essential first, reveal complexity on demand.
- **Error-Friendly Design** — assume errors will happen. Make recovery clear and immediate.

---

## Accessibility (WCAG 2.2+)

- **Semantic HTML first** — `<button>`, `<nav>`, `<main>`, `<dialog>`. No ARIA is better than wrong ARIA.
- **Focus management** — use `:focus-visible`, ensure focus is never trapped or lost.
- **Keyboard navigation** — all interactive elements reachable and operable via keyboard alone.
- **Color contrast** — minimum 4.5:1 for text, 3:1 for large text (WCAG AA minimum).
- **Reduced motion** — respect `prefers-reduced-motion` for animations.
- **Automated testing** — integrate `axe-core` and `jsx-a11y` in CI pipeline.

---

## Performance

- **Core Web Vitals**: Optimize LCP, INP, CLS as primary shipping criteria.
- **Code splitting**: Dynamic imports for routes and heavy components.
- **Image optimization**: `<Image>` (Next.js), AVIF/WebP, responsive `srcSet`.
- **Font loading**: `font-display: swap`, preload critical fonts.
- **Bundle analysis**: Regular audits with `@next/bundle-analyzer` or `vite-bundle-visualizer`.

---

## When to Use

Activate when the user asks to:
- Build, style, or fix UI components or pages
- Implement responsive layouts or design systems
- Build AI-native interfaces (streaming, agent UI, tool logs)
- Optimize frontend performance or Core Web Vitals
- Fix accessibility issues or implement WCAG compliance
- Integrate modern CSS features or animations
