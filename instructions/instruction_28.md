# Phase 1: Industrial Automation Theme & Typography Reset

You are tasked with executing **Phase 1 of the UI Remodel**: Overhauling the global theme tokens, color palettes, and typography to establish the "Industrial Printshop" aesthetic.

Do NOT modify component logic or page structures during this phase. Focus strictly on global CSS variables, font imports, and base CSS resets.

---

## Task 1: Typography Imports (`index.html` or main HTML header)

Update the font imports to load Google Fonts for `IBM Plex Mono` and `Space Grotesk`.

Add the following Google Fonts link to the top of the main HTML document (e.g., `admin-ui/index.html` or equivalent):

```html
<link rel="preconnect" href="[https://fonts.googleapis.com](https://fonts.googleapis.com)">
<link rel="preconnect" href="[https://fonts.gstatic.com](https://fonts.gstatic.com)" crossorigin>
<link href="[https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap](https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap)" rel="stylesheet">

```
**Above links are just representation of what font and font weight to use, we are not gonna user CDN links instead install all the fonts and save it in the fonts folder, import them using `@font-face` in css and use them**

---

## Task 2: Replace Theme Tokens (`theme.css` / CSS Custom Properties)

Locate the primary CSS theme declaration file (e.g., `admin-ui/src/styles/theme.css` or global styles) and replace the existing palette definitions with the **Industrial Automation Theme System**:

```css
/* ==========================================================================
   Industrial Automation Theme System
   ========================================================================== */

:root {
  /* Typography Variables */
  --font-mono: 'IBM Plex Mono', 'Courier Prime', monospace;
  --font-body: 'Space Grotesk', 'Inter', sans-serif;

  /* Global Layout Tokens */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 40px;

  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;
}

/* --- Dark Mode ("Cast Iron & Carbon") --- */
:root[data-theme="dark"] {
  /* Base Surfaces */
  --bg-primary: #1A1D20;        /* Cast Iron Base */
  --bg-surface: #24282D;        /* Machined Panel */
  --bg-surface-hover: #2D3238;  /* Panel Hover State */
  --bg-surface-alt: #202327;    /* Alternating Row Tint */
  --bg-paper: #2D3238;          /* Dark Carbon Sheet */

  /* Borders & Rules */
  --border-default: #3A4047;    /* Steel Trim */
  --border-active: #FF5500;     /* Safety Orange Focus */

  /* Typography Colors */
  --text-primary: #E6E8EA;      /* Bright Zinc */
  --text-secondary: #9098A2;    /* Stamped Steel */
  --text-mono: #FF5500;         /* Safety Orange Data */

  /* Brand Accents */
  --accent-primary: #FF5500;    /* Safety Orange */
  --accent-primary-hover: #E04B00;
  --accent-secondary: #00A396;  /* Press Cyan */
  --accent-glow: rgba(255, 85, 0, 0.15);

  /* Status Tokens */
  --status-idle: #00FF88;       /* Online Green */
  --status-error: #FF4444;      /* Industrial Red */
  --status-busy: #FFAA00;       /* Warning Orange */

  /* Shadows & Paper Effects */
  --shadow-paper: 0 12px 24px -6px rgba(0, 0, 0, 0.5), 0 0 0 1px #3A4047;
  --shadow-3d-btn: 0 4px 0 #000000;
}

/* --- Light Mode ("Raw Newsprint & Ink") --- */
:root[data-theme="light"] {
  /* Base Surfaces */
  --bg-primary: #F4F1EA;        /* Aged Cotton Paper Base */
  --bg-surface: #EBE6DC;        /* Pressed Cardstock */
  --bg-surface-hover: #E2DDD2;  /* Cardstock Hover State */
  --bg-surface-alt: #E6E1D7;    /* Alternating Row Tint */
  --bg-paper: #FDFBF7;          /* Fresh Sheet White */

  /* Borders & Rules */
  --border-default: #D2CBBE;    /* Cardboard Trim Edge */
  --border-active: #D03B00;     /* Press Red Focus */

  /* Typography Colors */
  --text-primary: #1C2024;      /* Carbon Ink */
  --text-secondary: #626A72;    /* Faded Stamp */
  --text-mono: #D03B00;         /* Press Red Data */

  /* Brand Accents */
  --accent-primary: #D03B00;    /* Deep Industrial Red-Orange */
  --accent-primary-hover: #B53300;
  --accent-secondary: #00665E;  /* Roller Cyan */
  --accent-glow: rgba(208, 59, 0, 0.12);

  /* Status Tokens */
  --status-idle: #16A34A;
  --status-error: #DC2626;
  --status-busy: #D97706;

  /* Shadows & Paper Effects */
  --shadow-paper: 0 10px 20px -5px rgba(0, 0, 0, 0.08), 0 0 0 1px #D2CBBE;
  --shadow-3d-btn: 0 4px 0 #9E9689;
}

```

---

## Task 3: Base CSS Reset & Typography Rules

Update `global.css` or `index.css` to enforce the font hierarchy across all elements:

```css
body {
  font-family: var(--font-body);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.2s ease, color 0.2s ease;
  -webkit-font-smoothing: antialiased;
}

/* Force Monospace on Headings, Data Metrics, Badges, and Code */
h1, h2, h3, h4, h5, h6,
.data-mono,
.badge,
.metric-value,
table th,
code,
pre {
  font-family: var(--font-mono);
  letter-spacing: -0.02em;
}

```

---

## Phase 1 Verification Criteria

1. Run `npm run dev` and toggle between light and dark mode.
2. Confirm dark mode uses the **Gunmetal Gray (`#1A1D20`)** base rather than pure black.
3. Confirm light mode uses the **Aged Paper (`#F4F1EA`)** base rather than stark white.
4. Verify headings and data tables switch to **IBM Plex Mono**, while body text uses **Space Grotesk**.