---
name: react-bits-pro
description: >
  Install and integrate React Bits Pro premium UI components, page-section
  blocks, and landing-page templates into React/Next.js apps via the shadcn
  registry CLI with license-key authentication. Use this skill whenever the user
  wants to add animated components (WebGL/shader backgrounds, GSAP and Motion
  animations, 3D effects, cursor trails, text animations, cards, carousels,
  galleries), pre-built page sections (hero, features, pricing, navigation,
  footer, FAQ, CTA, auth, stats, blog, contact, social proof, about, waitlist,
  showcase, how-it-works, download, ecommerce, profile, 404), or full
  landing-page templates. Also use when the user mentions "react bits",
  "reactbits", "@reactbits-starter", or "@reactbits-pro", or asks for premium
  animated React components, even if they do not name the library directly.
license: Proprietary
compatibility: >
  React 18 or 19. Next.js 14+ (App Router recommended) or any React framework
  that supports client components. Tailwind CSS v4 strongly recommended for
  blocks (they use v4 utility names). Node.js 18+ for the shadcn CLI.
metadata:
  author: reactbits
  version: "2.0"
---

# React Bits Pro Integration

You are integrating **React Bits Pro** — a premium, shadcn-compatible registry of
**101 animated components**, **238 page-section blocks** (21 categories), and
**11 landing-page templates** for React/Next.js apps. Items install as real source
files into the user's project; the user owns and can edit them.

This document is the single source of truth. Follow it literally. Where it says
"verify," verify — do not guess.

---

## Golden rules (read first, never break these)

1. **Never guess a block's import statement.** Block files use a *mix* of `export default`
   and named `export` styles, and the identifier does **not** reliably follow the slug
   (`404-3` exports `NotFound3`; `cta-3` exports `CTA3` but `cta-4` exports `Cta4`). After
   installing a block, read its `export` line and import accordingly. See
   [Importing installed items](#importing-installed-items).
2. **Components use a `-tw` or `-css` suffix; blocks use no suffix.** `silk-waves-tw` is a
   component; `hero-1` is a block. Mismatched names return 404.
3. **The license key is a secret.** Put it in `.env.local`, never commit it, never hardcode it.
4. **Never delete the `"use client"` directive.** Every component and block is a client component.
5. **WebGL/shader components need an explicitly sized parent** (a container with width and height).
6. **Do not overwrite the user's existing `components.json` fields** — only merge in `registries`.
7. **Templates are downloads, not CLI installs.** They come as `.zip` files from the website
   (Ultimate tier). See [Templates](#templates-ultimate-tier).

---

## TL;DR — fastest correct path

```bash
# 0. (once) Ensure the project is a shadcn project with the cn() helper.
npx shadcn@latest init            # only if components.json is missing

# 1. Add the license key to .env.local (never commit it):
#    REACTBITS_LICENSE_KEY=rbp...-your-key

# 2. Merge the two registries into components.json (see Step 3 below).

# 3. Install items (components take -tw/-css; blocks take no suffix):
npx shadcn@latest add @reactbits-starter/silk-waves-tw
npx shadcn@latest add @reactbits-pro/hero-1

# 4. Open the installed file, read its `export` line, then import it:
#    components/react-bits/silk-waves.tsx  -> export default  -> import SilkWaves from "@/components/react-bits/silk-waves"
#    components/blocks/hero-1.tsx          -> export function Hero1  -> import { Hero1 } from "@/components/blocks/hero-1"
```

If `components.json` already has the `@reactbits-starter` registry, you can also pull
this skill into the project as a local file:

```bash
npx shadcn@latest add @reactbits-starter/skill   # writes ./SKILL.md to the project root
```

---

## When to use this skill

Use it when the user wants to:

- Add React Bits Pro components, blocks, or templates to a project.
- Add animated UI (shaders, particles, 3D, WebGL, cursor effects, text/Motion/GSAP animations).
- Drop in pre-built page sections (hero, pricing, features, navigation, footer, FAQ, CTA, etc.).
- Assemble a landing page quickly from premium blocks.
- Mention "react bits", "reactbits", "@reactbits-starter", or "@reactbits-pro".

Do **not** use it to build generic shadcn/ui primitives (button, dialog, etc.) — those come
from the standard shadcn registry, not React Bits Pro.

---

## Architecture overview

React Bits Pro ships through the **shadcn registry protocol** over two
license-authenticated registries:

| Registry | Contains | Min. tier to install | Install prefix |
|---|---|---|---|
| `@reactbits-starter` | 101 animated components (each in 2 variants) | Starter | `@reactbits-starter/<slug>-tw` or `-css` |
| `@reactbits-pro` | 238 page-section blocks (21 categories) | **Pro** | `@reactbits-pro/<slug>` |

Tier hierarchy: **Starter → Pro → Ultimate** (each tier includes everything below it).

| Tier | License prefix | Components | Blocks | Templates |
|---|---|---|---|---|
| Starter | `rbps-` | ✅ | ❌ | free template only |
| Pro | `rbpp-` | ✅ | ✅ | free template only |
| Ultimate | `rbpu-` | ✅ | ✅ | ✅ all templates |

Items are written into the codebase as editable source files — they are **not** npm packages.

### Three product types — do not confuse them

| Type | Source | Suffix | Delivery | Tier |
|---|---|---|---|---|
| **Component** | `@reactbits-starter` | `-tw` / `-css` (required) | shadcn CLI | Starter+ |
| **Block** | `@reactbits-pro` | none | shadcn CLI | Pro+ |
| **Template** | website download | n/a | `.zip` download (login required) | Ultimate (1 free) |

### Component variants (`-tw` vs `-css`)

Every component exists in two functionally identical variants. **Pick exactly one per install.**

- **`-tw` (Tailwind)** — styles via Tailwind utility classes and the `cn()` helper. **Default choice.**
  Use this whenever the project uses Tailwind.
- **`-css` (vanilla CSS)** — ships a co-located `.css` file, no Tailwind required. Use only when the
  project does **not** use Tailwind.

Blocks have **no variants** — they are Tailwind-only, single-file.

### Where files are installed

Paths follow the user's `components.json` aliases (and `src/` dir if present). With defaults:

| Item | On-disk path | Import alias |
|---|---|---|
| Component (`-tw`) | `components/react-bits/<slug>.tsx` | `@/components/react-bits/<slug>` |
| Component (`-css`) | `components/react-bits/<slug>.tsx` + `<slug>.css` | `@/components/react-bits/<slug>` |
| Block | `components/blocks/<slug>.tsx` | `@/components/blocks/<slug>` |
| Skill file | `./SKILL.md` (project root) | n/a |

The shadcn CLI auto-installs each item's npm dependencies and any registry dependencies.

---

## Step 1 — Verify prerequisites

Confirm the project has all of the following before installing:

1. **`components.json` at the project root.** If missing:
   ```bash
   npx shadcn@latest init
   ```
2. **The `cn()` helper at `lib/utils.ts`** (required by every `-tw` component):
   ```typescript
   import { clsx, type ClassValue } from "clsx";
   import { twMerge } from "tailwind-merge";

   export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs));
   }
   ```
   If missing: `npm install clsx tailwind-merge`, then create the file above.
3. **Tailwind CSS configured** (for `-tw` components and all blocks). **Tailwind v4 is strongly
   recommended** — many blocks use v4-renamed utilities such as `bg-linear-to-br` (the v3 name is
   `bg-gradient-to-br`).
4. **A valid license key.** The user must have purchased a React Bits Pro plan. If they have not set
   one up, ask them for it (or point them to https://pro.reactbits.dev/pricing).

---

## Step 2 — Configure the license key

Add the key to `.env.local` at the project root:

```bash
REACTBITS_LICENSE_KEY=rbpp-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

- **Never commit `.env.local`.** Ensure `.gitignore` includes it (shadcn's `init` does this by default).
- The shadcn CLI reads this value to fill the `${REACTBITS_LICENSE_KEY}` placeholder in `components.json`.
- If the CLI cannot find the variable, export it in the shell before running `add`:
  ```bash
  export REACTBITS_LICENSE_KEY=rbpp-...
  ```
- The license prefix reveals the tier: `rbps-` = Starter, `rbpp-` = Pro, `rbpu-` = Ultimate.

---

## Step 3 — Configure `components.json`

Merge the `registries` object into the existing `components.json`. **Add only this key — do not touch
`$schema`, `style`, `tailwind`, `aliases`, or any other existing field.**

```json
{
  "registries": {
    "@reactbits-starter": {
      "url": "https://pro.reactbits.dev/api/r/starter/{name}.json",
      "headers": {
        "Authorization": "Bearer ${REACTBITS_LICENSE_KEY}"
      }
    },
    "@reactbits-pro": {
      "url": "https://pro.reactbits.dev/api/r/pro/{name}.json",
      "headers": {
        "Authorization": "Bearer ${REACTBITS_LICENSE_KEY}"
      }
    }
  }
}
```

The `{name}` token is replaced by the slug you pass to `add`. `${REACTBITS_LICENSE_KEY}` is read from
the environment / `.env.local`. Configure `@reactbits-starter` even if you only plan to use blocks —
it is also how you install this skill file.

---

## Step 4 — Install items

> Components **require** a `-tw` or `-css` suffix. Blocks take **no** suffix.

```bash
# Component — Tailwind variant (default choice)
npx shadcn@latest add @reactbits-starter/silk-waves-tw

# Component — vanilla-CSS variant (non-Tailwind projects only)
npx shadcn@latest add @reactbits-starter/silk-waves-css

# Block (Pro tier or higher)
npx shadcn@latest add @reactbits-pro/hero-1

# Several at once (components + blocks can be mixed)
npx shadcn@latest add @reactbits-starter/silk-waves-tw @reactbits-starter/animated-list-tw @reactbits-pro/hero-1 @reactbits-pro/pricing-2
```

Optional — inspect an item before installing:

```bash
npx shadcn@latest view @reactbits-starter/silk-waves-tw
```

---

## Importing installed items

This is the step agents most often get wrong. Get the export style right and the import follows.

### Components — always a default export

**Every** `@reactbits-starter` component is `export default`. Import it with **any** local name you like
(no braces):

```tsx
import SilkWaves from "@/components/react-bits/silk-waves";
import AnimatedList from "@/components/react-bits/animated-list";
```

### Blocks — mixed export styles, so verify every time

Block files are **not** consistent: some are `export default function X()` and some are
`export function X()`. The identifier also does **not** reliably match the slug. **Always confirm the
export line, then import accordingly.**

One reliable command to reveal it:

```bash
grep -E "^export (default )?function " components/blocks/<slug>.tsx
```

Apply this rule to the result:

| Export line in the file | Import to write |
|---|---|
| `export default function Anything()` | `import AnyName from "@/components/blocks/<slug>";` (default import — name is your choice) |
| `export function Hero1()` | `import { Hero1 } from "@/components/blocks/<slug>";` (named import — **must** match exactly) |

Examples:

```tsx
// hero-1.tsx contains:  export function Hero1()      -> NAMED import, exact identifier
import { Hero1 } from "@/components/blocks/hero-1";

// 404-3.tsx contains:   export default function NotFound3()  -> DEFAULT import, free name
import ErrorPage from "@/components/blocks/404-3";

// pricing-2.tsx contains: export default function Pricing2()  -> DEFAULT import
import Pricing from "@/components/blocks/pricing-2";
```

### Block import reference (verified)

If you cannot open the file, use this table. **Named-export** blocks must be imported with the **exact**
identifier in braces. **Default-export** blocks can be imported with any name (the listed identifier is the
file's own name, shown for reference). Watch the irregular casing.

**Named exports → `import { Identifier } from "@/components/blocks/<slug>"`:**

| Category | Slugs | Identifiers |
|---|---|---|
| Auth | `auth-1..6` | `Auth1` … `Auth6` |
| Blog | `blog-1..5`, `blog-8..11` | `Blog1` … `Blog5`, `Blog8` … `Blog11` |
| Download | `download-1..3`, `download-6..8` | `Download1` … `Download3`, `Download6` … `Download8` |
| Features | `features-1..5`, `features-10..13` | `Features1` … `Features5`, `Features10` … `Features13` |
| Footer | `footer-5`, `footer-6` | `Footer5`, `Footer6` |
| Hero | `hero-1..24` | `Hero1` … `Hero24` (all heroes are named) |
| How It Works | `how-it-works-1..3`, `how-it-works-7..9` | `HowItWorks1..3`, `HowItWorks7..9` |
| Navigation | `navigation-2..8` | `Navigation2` … `Navigation8` |
| Pricing | `pricing-5`, `pricing-6` | `Pricing5`, `Pricing6` |
| Showcase | `showcase-1..3`, `showcase-6..8` | `Showcase1..3`, `Showcase6..8` |
| Social Proof | `social-proof-7..9` | `SocialProof7`, `SocialProof8`, `SocialProof9` |

**Default exports → `import AnyName from "@/components/blocks/<slug>"`:**

| Category | Slugs | File identifiers |
|---|---|---|
| 404 | `404-1..8` | `NotFound1` … `NotFound8` ⚠️ not "404…" |
| About | `about-1..12` | `About1` … `About12` |
| Blog | `blog-6`, `blog-7` | `Blog6`, `Blog7` |
| Comparison | `comparison-1..8` | `Comparison1` … `Comparison8` |
| Contact | `contact-1..12` | `Contact1` … `Contact12` |
| CTA | `cta-1..14` | `CTA1..3`, then `Cta4` … `Cta10`, then `CTA11..14` ⚠️ irregular casing |
| Download | `download-4`, `download-5` | `Download4`, `Download5` |
| Ecommerce | `ecommerce-1..11` | `Ecommerce1` … `Ecommerce11` |
| FAQ | `faq-1..9` | `FAQ1..3`, then `Faq4`, `Faq5`, then `FAQ6..9` ⚠️ irregular casing |
| Features | `features-6..9` | `Features6` … `Features9` |
| Footer | `footer-1..4`, `footer-7..12` | `Footer1` … `Footer4`, `Footer7` … `Footer12` |
| How It Works | `how-it-works-4..6` | `HowItWorks4`, `HowItWorks5`, `HowItWorks6` |
| Navigation | `navigation-1`, `navigation-9..15` | `Navigation1`, `Navigation9` … `Navigation15` |
| Pricing | `pricing-1..4`, `pricing-7..15` | `Pricing1` … `Pricing4`, `Pricing7` … `Pricing15` |
| Profile | `profile-1..6` | `Profile1` … `Profile6` |
| Showcase | `showcase-4`, `showcase-5` | `Showcase4`, `Showcase5` |
| Social Proof | `social-proof-1..6`, `social-proof-10..16` | `SocialProof1` … `SocialProof6`, `SocialProof10` … `SocialProof16` |
| Stats | `stats-1..15` | `Stats1` … `Stats15` |
| Waitlist | `waitlist-1..6` | `Waitlist1` … `Waitlist6` |

> If this table ever disagrees with the installed file, **trust the file** and re-run the `grep` check above.

### Using an installed component

```tsx
import SilkWaves from "@/components/react-bits/silk-waves";

export default function Page() {
  return (
    // WebGL/shader components require a sized parent:
    <div className="h-screen w-full">
      <SilkWaves
        speed={1}
        scale={2}
        colors={["#0d1326", "#162a52", "#1e407e", "#2657aa", "#2e6ed5", "#3785ff", "#5092ff", "#69a0ff"]}
      />
    </div>
  );
}
```

### Using an installed block

```tsx
import { Hero1 } from "@/components/blocks/hero-1";   // named export → braces

export default function LandingPage() {
  return (
    <main>
      <Hero1 />
    </main>
  );
}
```

Blocks render full-width sections and take **no props** — customize them by editing the source file.

---

## Composing a landing page from blocks

```bash
npx shadcn@latest add \
  @reactbits-pro/navigation-1 \
  @reactbits-pro/hero-1 \
  @reactbits-pro/features-1 \
  @reactbits-pro/social-proof-1 \
  @reactbits-pro/pricing-1 \
  @reactbits-pro/faq-1 \
  @reactbits-pro/cta-1 \
  @reactbits-pro/footer-1
```

```tsx
// Imports below mix default and named — verified per the reference table above.
import Navigation1 from "@/components/blocks/navigation-1";      // default export
import { Hero1 } from "@/components/blocks/hero-1";              // named export
import { Features1 } from "@/components/blocks/features-1";      // named export
import SocialProof1 from "@/components/blocks/social-proof-1";   // default export
import Pricing1 from "@/components/blocks/pricing-1";            // default export
import Faq1 from "@/components/blocks/faq-1";                    // default export (file identifier: FAQ1)
import CTA1 from "@/components/blocks/cta-1";                    // default export (file identifier: CTA1)
import Footer1 from "@/components/blocks/footer-1";              // default export

export default function LandingPage() {
  return (
    <>
      <Navigation1 />
      <Hero1 />
      <Features1 />
      <SocialProof1 />
      <Pricing1 />
      <Faq1 />
      <CTA1 />
      <Footer1 />
    </>
  );
}
```

Then edit each block's source to replace placeholder copy, images (`/svg/placeholder.svg`), and links;
adjust colors/spacing; and wire up forms and buttons.

---

## Combining components with blocks

Standalone components can sit behind or alongside blocks (e.g. an animated background):

```tsx
import SilkWaves from "@/components/react-bits/silk-waves";
import { Hero1 } from "@/components/blocks/hero-1";

export default function LandingPage() {
  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10">
        <SilkWaves speed={0.5} opacity={0.3} />
      </div>
      <Hero1 />
    </div>
  );
}
```

---

## Customizing

Everything installs as editable source — customize freely.

**Components** accept rich props. Example (`SilkWaves`):

```tsx
<SilkWaves
  speed={1.5}
  scale={3}
  distortion={0.8}
  curve={1.2}
  contrast={1}
  colors={["#1a0533", "#2d1b69", "#4a2c8a", "#6b3fa0", "#8b52b8", "#ab65d0", "#cb78e8", "#eb8bff"]}
  rotation={45}
  brightness={1.2}
  opacity={0.9}
  complexity={1.5}
  frequency={1.2}
  className="absolute inset-0"
/>
```

For deeper changes, edit the installed `.tsx` directly: animation timing, breakpoints, new props, color
schemes, data/state wiring, API integration. **Blocks are designed to be edited** — they take no props,
so all customization happens in the file.

---

## Dark mode

Blocks and most components support dark mode via Tailwind's `dark:` class strategy. Ensure a theme
provider toggles a `dark` class on `<html>` (e.g. `next-themes`):

```tsx
// app/layout.tsx
import { ThemeProvider } from "next-themes";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

A few components read the active theme via `next-themes` and adapt their defaults automatically.

---

## Dependencies

The shadcn CLI installs each item's npm dependencies automatically. Know them for troubleshooting:

| Package | Used by | Notes |
|---|---|---|
| `three` | All shader / WebGL / 3D components | Import as `import * as THREE from "three"`. Needs a WebGL-capable browser and a sized container. |
| `@react-three/fiber`, `@react-three/drei` | Some 3D components | React renderer + helpers for Three.js. |
| `motion` | Most components and many blocks | Motion v11. **Import from `motion/react`**, not `framer-motion`. |
| `gsap`, `@gsap/react` | `text-path`, `3d-text-reveal`, `click-stack`, some blocks | `ScrollTrigger` is registered inside the component. |
| `lucide-react` | Most blocks | Icon set. |
| `matter-js` | `404-5` | 2D physics. |
| `lenis` | `about-5` | Smooth scrolling (loaded dynamically). |
| `next-themes` | Theme-aware components | Dark-mode provider. |

There is **no** `d3` or `framer-motion` dependency in the distributed items — always use `motion/react`.

> Edge case: a few blocks load a package via a dynamic `import()` (e.g. `about-5` → `lenis`). The CLI may
> not auto-install these. If a block throws "module not found" at runtime, install the named package manually
> (e.g. `npm install lenis`).

### `"use client"` is required

Every component and block begins with `"use client"`. In the Next.js App Router you can import them
directly into Server Components — Next.js handles the client boundary. **Never remove `"use client"`.**

---

## Templates (Ultimate tier)

Templates are **full landing-page projects delivered as `.zip` downloads** — they are **not** installed
through the shadcn CLI. There is no `@reactbits-pro/<template>` install command.

To obtain a template, the user must:

1. Be **logged in** at https://pro.reactbits.dev with an **Ultimate** license (prefix `rbpu-`).
2. Download the `.zip` from the template's page (the free `portfolio-template` needs no login/Ultimate).
3. Unzip it and follow its own README to install and run.

| Template | Slug | Tier |
|---|---|---|
| SaaS Landing | `saas-landing` | Ultimate |
| AI SaaS Landing | `ai-saas-landing` | Ultimate |
| Minimal Landing | `minimal-landing` | Ultimate |
| Finance Landing | `finance-landing` | Ultimate |
| Agency Site | `agency-site` | Ultimate |
| Shader Template | `shader-template` | Ultimate |
| Wireframe Template | `wireframe-template` | Ultimate |
| 8 Bit Template | `8-bit-template` | Ultimate |
| AI App Template | `ai-app-template` | Ultimate |
| Security Template | `security-template` | Ultimate |
| Portfolio Template | `portfolio-template` | **Free** |

If a user on Starter/Pro asks to "install a template," explain that templates require the Ultimate plan
(except Portfolio) and are downloaded from the website — then offer to build an equivalent page from blocks.

---

## Troubleshooting

The registry API returns clear JSON errors. Map them as follows:

| Symptom / error | Cause | Fix |
|---|---|---|
| `Unknown registry @reactbits-starter` | `registries` missing from `components.json` | Add it per Step 3. |
| `401 Unauthorized — License key required` | `REACTBITS_LICENSE_KEY` not set / not readable by the CLI | Add it to `.env.local`, or `export` it in the shell. |
| `401 Unauthorized — Invalid license key` | Wrong, expired, or revoked key | Verify the key; check it is active in the Polar customer portal. |
| `403 Forbidden — Insufficient tier` | Tier too low for the item | Blocks need **Pro+**; templates need **Ultimate**. Upgrade at /pricing. |
| Component `404 — must end with -css or -tw` | Missing variant suffix | Use `silk-waves-tw` or `silk-waves-css`, never bare `silk-waves`. |
| Block `404 — does not exist` | Wrong slug or an accidental suffix | Blocks take **no** suffix: `hero-1`, not `hero-1-tw`. Check the slug exists in the catalog. |
| Import error / "X is not exported" | Wrong import style for a block | Re-check the file's `export` line; named exports need braces, default exports do not. |
| `cn` is not defined | Missing helper | `npm install clsx tailwind-merge` and create `lib/utils.ts` (Step 1). |
| WebGL component renders blank | No size, or no WebGL | Give the parent explicit width/height; ensure `three` installed; the browser must support WebGL. |
| Block gradients/utilities look broken | Project on Tailwind **v3** | Blocks use Tailwind **v4** utility names (e.g. `bg-linear-to-*`). Upgrade to v4, or rename classes (`bg-linear-to-r` → `bg-gradient-to-r`). |
| Blocks completely unstyled | Tailwind not scanning the files | Ensure Tailwind is configured and `globals.css` imports it (`@import "tailwindcss";` in v4). |
| GSAP scroll effects don't fire | Custom scroll container | These expect the default document scroll unless you rewire `ScrollTrigger`. |

Alternative auth (if env substitution is unavailable): the API also accepts an `X-License-Key: <key>`
header or a `?license_key=<key>` query parameter.

---

## Best practices

1. **Verify the export line before importing a block** — this is the #1 source of breakage.
2. **Pick one component variant project-wide** — use `-tw` for Tailwind projects (smaller, better integrated);
   reserve `-css` for non-Tailwind projects.
3. **Wrap WebGL components in a sized container**, and lazy-load heavy ones below the fold:
   ```tsx
   import dynamic from "next/dynamic";
   const SilkWaves = dynamic(() => import("@/components/react-bits/silk-waves"), { ssr: false });
   ```
4. **Treat blocks as starting points** — edit copy, images, links, and styles directly in the source.
5. **Keep the license key in env vars** — never hardcode or commit it.
6. **Prefer Tailwind v4** so block utilities render correctly out of the box.
7. **Install this skill locally** for offline reference: `npx shadcn@latest add @reactbits-starter/skill`.

---

## Appendix A — Component catalog (`@reactbits-starter`, 101, Starter tier)

Install any of these as `@reactbits-starter/<slug>-tw` (Tailwind) or `<slug>-css` (vanilla CSS).
All are `export default`. Components described as shader/WebGL/3D/particle render to a canvas — give them a
sized parent and consider `ssr: false`.

### Text & typography (8)
| Slug | Name | Description |
|---|---|---|
| `staggered-text` | Staggered Text | Feature-rich staggered text reveals |
| `glitch-text` | Glitch Text | Canvas sticky glitch text reacting to the cursor |
| `text-path` | Text Path | Text animated along an SVG path (GSAP) |
| `3d-text-reveal` | 3D Text Reveal | Scroll-triggered 3D text animation (GSAP) |
| `particle-text` | Particle Text | Interactive 3D WebGL particle text |
| `text-scatter` | Text Scatter | Interactive letter-scatter effect |
| `3d-letter-swap` | 3D Letter Swap | Staggered 3D letter swap |
| `blur-highlight` | Blur Highlight | Blur-in paragraph with auto text highlighting |

### Cursor effects (7)
| Slug | Name | Description |
|---|---|---|
| `smooth-cursor` | Smooth Cursor | Canvas smooth cursor trail with spring physics |
| `custom-cursor` | Custom Cursor | Cursor with smooth target morphing |
| `dither-cursor` | Dither Cursor | Pixelated dithering trail |
| `ascii-cursor` | Ascii Cursor | ASCII-character trail cursor |
| `glass-cursor` | Glass Cursor | Glass cursor with refraction and blur |
| `cursor-wave` | Cursor Wave | Grid of shapes reacting to cursor and clicks |
| `user-cursor` | User Cursor | Cursor with a follower name tag |

### Cards & interactive (9)
| Slug | Name | Description |
|---|---|---|
| `shader-card` | Shader Card | Card with animated WebGL shader background |
| `chroma-card` | Chroma Card | Card with chromatic color shifting |
| `credit-card` | Credit Card | 3D credit card with parallax tilt |
| `depth-card` | Depth Card | Perspective depth reacting to the mouse |
| `modal-cards` | Modal Cards | Cards expanding into full-screen modals |
| `rotating-cards` | Rotating Cards | Draggable 3D circular card carousel |
| `parallax-cards` | Parallax Cards | Layered cards with mouse-driven parallax |
| `click-stack` | Click Stack | Click-to-cycle animated card stack (GSAP) |
| `warped-card` | Warped Card | Image card with mouse-following bulge shader |

### Backgrounds, shaders & visual effects (57)
| Slug | Name | Description |
|---|---|---|
| `silk-waves` | Silk Waves | Smooth flowing silk-like waves |
| `shader-waves` | Shader Waves | Animated wave patterns with noise |
| `chroma-waves` | Chroma Waves | Wave shader with noise distortion |
| `aurora-blur` | Aurora Blur | Ethereal aurora-borealis blur |
| `gradient-blob` | Gradient Blob | Morphing 3D blob with cursor interaction |
| `ai-blob` | AI Blob | Animated 3D blob with glow |
| `dither-wave` | Dither Wave | Wave with retro dithering |
| `radial-liquid` | Radial Liquid | Radial shader waves with distortion |
| `grain-wave` | Grain Wave | Grainy wave texture |
| `glass-flow` | Glass Flow | Flowing glass-like blur |
| `falling-rays` | Falling Rays | Rays falling like rain of light |
| `light-droplets` | Light Droplets | Falling light streaks with glow |
| `lightspeed` | Lightspeed | Hyperspace light-streak effect |
| `rising-lines` | Rising Lines | Ascending lines/particles with a laser beam |
| `liquid-bars` | Liquid Bars | Liquid bars with smooth wave motion |
| `liquid-lines` | Liquid Lines | Flowing liquid lines |
| `shadow-bars` | Shadow Bars | Animated shadow bars with depth |
| `color-loops` | Color Loops | Colorful orbital loops |
| `mosaic` | Mosaic | Mosaic over an animated wave or video |
| `flicker` | Flicker | Flickering particle grid |
| `vortex` | Vortex | Spinning 3D tunnel with particles |
| `portal` | Portal | Circular portal shader with particles |
| `perspective-grid` | Perspective Grid | Infinite 3D perspective grid (WebGL) |
| `glitter-warp` | Glitter Warp | Starfield warp tunnel |
| `star-burst` | Star Burst | Star-burst particle explosion |
| `rotating-stars` | Rotating Stars | Orbiting star particles |
| `dot-shift` | Dot Shift | Shifting grid of animated dots |
| `synaptic-shift` | Synaptic Shift | Neural-network connection animation |
| `ascii-waves` | Ascii Waves | Waves rendered as ASCII characters |
| `squircle-shift` | Squircle Shift | Morphing squircle animation |
| `center-flow` | Center Flow | Radial flow from the center |
| `warp-twister` | Warp Twister | Twisting warp distortion |
| `neon-reveal` | Neon Reveal | Neon bar sweep |
| `agentic-ball` | Agentic Ball | 3D orb with swirl and glow |
| `black-hole` | Black Hole | Gravitational particles with color cycling |
| `blurred-rays` | Blurred Rays | Flickering vertical light beams with bloom |
| `flame-paths` | Flame Paths | Flame-like wave effect |
| `frame-border` | Frame Border | Animated noise-textured border |
| `gradient-bars` | Gradient Bars | Animated striped gradient bars |
| `halftone-vortex` | Halftone Vortex | Cursor-reactive halftone dot vortex |
| `halftone-wave` | Halftone Wave | Halftone dot grid with noise |
| `liquid-ascii` | Liquid Ascii | Fluid simulation as ASCII characters |
| `metallic-swirl` | Metallic Swirl | Metallic swirl shader |
| `retro-lines` | Retro Lines | Retro perspective grid with scrolling waves |
| `rubber-fluid` | Rubber Fluid | Rubbery fluid distortion shader |
| `simple-swirl` | Simple Swirl | Concentric swirl with glow |
| `square-matrix` | Square Matrix | Animated dot grid with wave presets |
| `star-swipe` | Star Swipe | Conformal star-warp shader |
| `swirl-blend` | Swirl Blend | Iterative swirl shader with palette controls |
| `text-cube` | Text Cube | Cursor-following 3D text cube |
| `watercolor` | Watercolor | Watercolor noise shader, two-color blend |
| `fog-sphere` | Fog Sphere | Soft swirling sphere of fog |
| `ascii-tiles` | ASCII Tiles | Glassy tiles of glowing ASCII characters |
| `twilight-lines` | Twilight Lines | Glowing lines pulsing with a warm sweep |
| `chroma-blinds` | Chroma Blinds | Diagonal stripes bending toward the cursor |
| `glass-tiles` | Glass Tiles | Shimmering colorful glass tiles |
| `blinking-squares` | Blinking Squares | Grid of quietly twinkling squares |

### Galleries, carousels & layout (10)
| Slug | Name | Description |
|---|---|---|
| `circle-gallery` | Circle Gallery | Draggable circular carousel with inertia |
| `gradient-carousel` | Gradient Carousel | 3D carousel with dynamic gradient extraction |
| `circles` | Circles | Rotating orbital rings with images |
| `draggable-grid` | Draggable Grid | Pannable grid with drag and momentum |
| `animated-list` | Animated List | List with multiple entrance animations |
| `comparison-slider` | Comparison Slider | Before/after image comparison |
| `hover-preview` | Hover Preview | Image previews on hovering target words |
| `infinite-gallery` | Infinite Gallery | 3D infinite scrolling gallery with parallax |
| `parallax-carousel` | Parallax Carousel | Draggable image carousel with parallax |
| `circle-stack` | Circle Stack | Tilted cycling stack of circular images |

### Images & reveals (5)
| Slug | Name | Description |
|---|---|---|
| `shader-reveal` | Shader Reveal | Interactive liquid image reveal |
| `liquid-swap` | Liquid Swap | Image transition via a liquid glass ball |
| `pixelate-hover` | Pixelate Hover | Cursor-controlled pixelation reveal |
| `pixel-reveal` | Pixel Reveal | Image revealed through a pixel sweep |
| `magic-transform` | Magic Transform | Documents fly in and resolve into results |

### Other / utility (5)
| Slug | Name | Description |
|---|---|---|
| `globe` | Globe | Interactive 3D globe with animated arcs |
| `device` | Device | CSS device mockup with custom content |
| `simple-graph` | Simple Graph | Animated, customizable line graph |
| `preloader` | Preloader | Animated loading screens, multiple variants |
| `parallax-pills` | Parallax Pills | Bouncy labeled pills drifting with the cursor |

---

## Appendix B — Block catalog (`@reactbits-pro`, 238, Pro tier)

Install as `@reactbits-pro/<slug>` (no suffix). Slugs are sequential within each category starting at 1.
See [Block import reference](#block-import-reference-verified) for the per-slug export style.

| Category | Slug range | Count | What it covers |
|---|---|---|---|
| Hero | `hero-1` … `hero-24` | 24 | Headers/heroes: split, centered, video, carousel, WebGL, animated |
| Features | `features-1` … `features-13` | 13 | Feature grids, tabs, marquees, auto-cycling carousels |
| Social Proof | `social-proof-1` … `social-proof-16` | 16 | Logos, testimonials, reviews, marquees, video |
| Contact | `contact-1` … `contact-12` | 12 | Contact forms and split/card layouts |
| Footer | `footer-1` … `footer-12` | 12 | Footers with links, newsletter, branding |
| Comparison | `comparison-1` … `comparison-8` | 8 | Feature/pricing comparison tables and charts |
| Navigation | `navigation-1` … `navigation-15` | 15 | Top/side/bottom navs and mobile menus |
| Auth | `auth-1` … `auth-6` | 6 | Sign-in / sign-up layouts |
| Call To Action | `cta-1` … `cta-14` | 14 | CTAs with parallax, cursor trails, video masks |
| FAQ | `faq-1` … `faq-9` | 9 | Accordion, chat-style, tabbed FAQs |
| Pricing | `pricing-1` … `pricing-15` | 15 | Pricing tables with toggles and comparisons |
| Stats | `stats-1` … `stats-15` | 15 | Metrics with charts, maps, animations |
| 404 | `404-1` … `404-8` | 8 | Creative error pages |
| Profile | `profile-1` … `profile-6` | 6 | User profile cards and sections |
| About | `about-1` … `about-12` | 12 | Story, timeline, team, metrics |
| Waitlist | `waitlist-1` … `waitlist-6` | 6 | Pre-launch signup sections |
| Showcase | `showcase-1` … `showcase-8` | 8 | Portfolio and product display |
| How It Works | `how-it-works-1` … `how-it-works-9` | 9 | Step-by-step process sections |
| Download | `download-1` … `download-8` | 8 | App/file download sections |
| Blog | `blog-1` … `blog-11` | 11 | Blog listings and article layouts |
| Ecommerce | `ecommerce-1` … `ecommerce-11` | 11 | Product pages, catalogs, storefronts |

---

## Quick reference

- **Install component:** `npx shadcn@latest add @reactbits-starter/<slug>-tw` (or `-css`)
- **Install block:** `npx shadcn@latest add @reactbits-pro/<slug>`
- **Install this skill:** `npx shadcn@latest add @reactbits-starter/skill`
- **Component import:** `import AnyName from "@/components/react-bits/<slug>"` (always default)
- **Block import:** open the file → `export default` ⇒ default import · `export function X` ⇒ `import { X }`
- **Reveal a block's export:** `grep -E "^export (default )?function " components/blocks/<slug>.tsx`
- **Tiers:** Starter = components · Pro = + blocks · Ultimate = + template downloads
- **Live catalogs:** https://pro.reactbits.dev/components · /blocks · /templates
