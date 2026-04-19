# `index.html` — EduVerse Landing Page

## Overview

`index.html` is the **public-facing marketing and landing page** of EduVerse. It is the entry point for unauthenticated visitors and serves to introduce the platform, highlight features, showcase supported education levels, present role-based portals (student, teacher, parent, institute, admin), and direct users to sign in or register.

This page requires **no authentication** and contains **no API calls**. It is entirely static.

---

## File Location

```
eduverse/
└── index.html   ← this file (project root)
```

---

## Purpose

- Market the EduVerse platform to prospective users
- Provide navigation links to `login.html` and `register.html`
- Explain platform features, supported education levels, user roles, and testimonials
- Serve as the public home (`/`) of the application

---

## Dependencies

### External (CDN)

| Library | Version | Purpose |
|---|---|---|
| Feather Icons | 4.29.1 | SVG icon set |
| Google Fonts — Inter | latest | UI body font |
| Google Fonts — Merriweather | latest | Hero heading serif font |

### Internal CSS (loaded in order)

| File | Purpose |
|---|---|
| `css/variables.css` | Design tokens (colors, spacing, typography) |
| `css/reset.css` | CSS normalisation |
| `css/global.css` | Base element styles |
| `css/components.css` | Reusable UI components |
| `css/layout.css` | Structural layout primitives |

### Internal JS

None. This page contains only a small inline script for scroll-based animation and mobile navigation toggling using native DOM APIs.

---

## Page Sections

| Section / Anchor | Description |
|---|---|
| `<nav>` (`.landing-nav`) | Top navigation bar with brand logo, nav links, Sign In and Get Started CTA buttons |
| `.hero` | Full-viewport hero section with gradient background, radial glow, grid overlay, headline, subtitle, and two CTA buttons |
| `#levels` | Education levels grid (Pre-School → Postgraduate) with emoji icons and descriptions |
| `#features` | Platform feature highlights (video lessons, assignments, quizzes, certificates, messaging, etc.) |
| `#roles` | Role cards: Student, Teacher, Parent, Institute, Admin — each with a description and CTA link |
| `#testimonials` | Quote cards from fictional users across roles |
| `.cta-section` | Final conversion section with "Get Started Free" button |
| `<footer>` | Footer links, copyright |

---

## Key HTML Patterns

### Hero Heading with Gradient Accent

```html
<h1 class="hero-title">
  Learn Without Limits
  <span class="hero-title-accent">at Every Stage</span>
</h1>
```

The `.hero-title-accent` class uses `background-clip: text` with a blue-to-violet gradient to produce a coloured text effect.

### Navigation CTA Buttons

```html
<a href="pages/auth/login.html"    class="btn-hero-secondary">Sign In</a>
<a href="pages/auth/register.html" class="btn-hero-primary">Get Started Free</a>
```

### Background Effects

- `.hero-glow` — a radial gradient pseudo-element creating a blue glow behind the hero text
- `.hero-grid` — a subtle 60×60px grid overlay using CSS `background-image` with linear gradients
- CSS animations: `fadeSlideDown`, `pulse` for entrance and breathing effects

---

## Theming

No dark/light theme switching on this page. The landing page uses a fixed dark background (`#0b0e1a`) with light text, independent of the application theme system used in student pages.

---

## Routing

All navigation on this page uses standard `<a href>` anchor links:

| Destination | Path |
|---|---|
| Login | `pages/auth/login.html` |
| Register | `pages/auth/register.html` |
| In-page anchors | `#levels`, `#features`, `#roles`, `#testimonials` |

---

## Authentication

None required. This page is fully public and has no auth guard.

---

## SEO & Meta

```html
<meta name="description" content="EduVerse is the complete e-learning platform..." />
<meta property="og:type"        content="website" />
<meta property="og:title"       content="EduVerse — Every Stage. Every Learner." />
<meta property="og:description" content="..." />
<meta property="og:image"       content="/assets/og-image.png" />
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
```

Open Graph tags enable rich link previews on social media and messaging apps.

---

## Accessibility

- `<nav>` has `role="navigation"` and `aria-label="Main navigation"`
- Nav links have `role="listitem"` inside a `role="list"` wrapper
- Brand logo link has `aria-label="EduVerse home"`
- Decorative elements use `aria-hidden="true"`

---

## Notes for Developers

- This file lives at the **project root**, not inside `pages/`. All CSS paths are therefore `css/...` (not `../../css/...`).
- No JavaScript modules (`api.js`, `store.js`, etc.) are loaded here.
- To add analytics, insert a script tag before `</body>`.
- To change the hero CTA destination, update the two `<a href>` elements in `.landing-nav-actions` and `.hero-cta`.
