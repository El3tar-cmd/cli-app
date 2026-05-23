# 🎨 Frontend, UX/UI & Design Systems (2026 Edition)

> Skills for building professional, accessible, performant user interfaces.

## React & Next.js (2026 Standards)

### React Compiler Era
- **Trust the React Compiler** — manual `useMemo`, `useCallback`, `React.memo` are now legacy. The compiler handles performance at build time.
- Write **clean, straightforward component logic** without worrying about re-render optimization.
- Use **React Server Components (RSC)** as the default. Client Components only for interactivity (`useState`, `useEffect`, event handlers).
- **Server Actions** for form handling and mutations — replaces API route boilerplate.

### Next.js App Router
- App Router is the standard. Use `app/` directory with layouts, loading states, and error boundaries.
- Default to **streaming** and **Suspense** for progressive page loading.
- Use `generateMetadata()` for SEO, `generateStaticParams()` for static generation.
- Implement **Parallel Routes** and **Intercepting Routes** for complex UI patterns.

### TypeScript (Non-Negotiable)
- Enable `strict: true` in all projects.
- Use **discriminated unions** for state management.
- Use `satisfies` operator for type-safe object literals.
- Use **Zod** for runtime validation at API boundaries.
- Avoid `any` — use `unknown` with type guards.

## Modern CSS (2026 — The CSS Renaissance)

### Layout
- **CSS Grid** for macro-layouts (page skeletons, dashboards).
- **Flexbox** for micro-layouts (component internals).
- **Container Queries** (`@container`) — components adapt to parent size, not viewport. This replaces most media queries for component-level responsiveness.

### Native CSS Power Features
| Feature | Replaces |
|---------|----------|
| `@container` queries | JS-based responsive components |
| `:has()` selector | Parent selectors (previously impossible) |
| Native CSS Nesting | SCSS/LESS nesting |
| `@layer` (Cascade Layers) | Specificity hacks, `!important` wars |
| `oklch()` color space | HSL, limited color gamuts |
| Relative color syntax | JS color manipulation libraries |
| `text-box-trim` | Whitespace/line-height hacks |
| `@starting-style` | JS-based enter animations |
| Scroll-driven animations | IntersectionObserver for scroll effects |
| View Transitions API | JS page transition libraries |

### Design Tokens
- Define all tokens as CSS custom properties: colors, spacing, typography, shadows, radii.
- Use `oklch()` for perceptually uniform color palettes.
- Support light/dark themes via `prefers-color-scheme` + CSS custom properties.

## UX/UI Design (2026 Trends)

- **AI-Driven Adaptation** — interfaces dynamically reorganize based on user behavior and intent.
- **Motion with Meaning** — animations guide users and reduce cognitive load, not just "delight."
- **Functional Minimalism** — reduce friction and visual noise as features increase.
- **Context-Aware Design** — anticipate user needs using real-time data.
- **Progressive Disclosure** — show essential content first, reveal complexity on demand.

## Accessibility (WCAG 2.2+)

- **Semantic HTML First** — `<button>`, `<nav>`, `<main>`, `<dialog>`. No ARIA is better than bad ARIA.
- **Focus Management** — use `:focus-visible`, ensure "Focus Not Obscured" (WCAG 2.2).
- **Keyboard Navigation** — all interactive elements reachable and operable via keyboard.
- **Color Contrast** — minimum 4.5:1 for text, 3:1 for large text (WCAG AA).
- **Screen Reader Testing** — test with NVDA/VoiceOver, not just automated tools.
- **Reduced Motion** — respect `prefers-reduced-motion` media query.
- **Automated CI Testing** — integrate `axe-core` and `jsx-a11y` into the pipeline.

## Performance

- **Core Web Vitals** — optimize LCP, FID/INP, CLS as primary metrics.
- **Code Splitting** — dynamic imports, route-based splitting.
- **Image Optimization** — `<Image>` component (Next.js), AVIF/WebP, responsive `srcSet`.
- **Font Loading** — `font-display: swap`, preload critical fonts, use `size-adjust`.
- **Bundle Analysis** — regular audits with `@next/bundle-analyzer` or `vite-bundle-visualizer`.

## When to Use

Activate these skills when the user asks to:
- Build, style, or fix UI components
- Implement responsive layouts or design systems
- Optimize frontend performance or Core Web Vitals
- Fix accessibility issues or implement WCAG compliance
- Integrate modern CSS features or animation
