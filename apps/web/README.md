# InternFlow Frontend

> Next.js web application for the InternFlow platform — a dashboard for AI-powered code review, internship discovery, and resume building.

## Overview

InternFlow is a Next.js 14+ application built with TypeScript and Tailwind CSS. It provides students with GitHub repository browsing, AI code review, a live internship feed, and a resume builder through a clean, custom-themed interface.

## Features

### User Management
- **Email / Password Auth**: Register and sign in with JWT-based sessions
- **Persistent Sessions**: Token stored in `localStorage`, sent as `Authorization: Bearer` on every request
- **Protected Dashboard**: All app pages sit behind `AppShell`, which redirects unauthenticated users

### GitHub Integration
- **GitHub OAuth**: Connect a GitHub account via backend OAuth flow; token returned in the redirect URL
- **Repository Browser**: Select a repo, navigate directories, preview file contents
- **AI Code Review**: Send any open file to the backend for an instant review
- **README Generation**: Auto-generate a README for the selected repo using RAG

### Internship Feed
- **Live Listings**: Pulls up to 50 postings from the backend (`/jobs/`), refreshed daily
- **Multi-source**: Aggregates jobs across multiple boards, displayed with source and date
- **One-click Apply**: Direct links to each posting

### Resume Builder
- **Write by hand**: Title + professional summary saved to `/resume/create`
- **Generate from a job**: Paste a job description plus your skills and experience; downloads a PDF from the backend
- **Tabbed UI**: Both modes share the same `/resume` route, switching between `/resume/builder` and `/resume/generate`

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| **Next.js** | 14+ | React framework (App Router) |
| **React** | 18+ | UI components |
| **TypeScript** | 5+ | Static typing |
| **Tailwind CSS** | 3+ | Utility-first styling (+ custom CSS vars) |
| **Three.js / R3F** | 0.160 / 8.15 | 3D commit graph on the landing page |
| **Razorpay** | 2.8 | Payment integration |
| **xterm.js** | 5.3 | WebSocket terminal |

## Project Structure

```
apps/web/
├── app/
│   ├── page.tsx                  # Landing page (HeroGraph + marketing copy)
│   ├── login/page.tsx            # Email/password sign-in
│   ├── register/page.tsx         # Account creation
│   ├── dashboard/page.tsx        # Overview with links to all tools
│   ├── github/page.tsx           # Repo browser + code review + README gen
│   ├── jobs/page.tsx             # Internship feed
│   └── resume/
│       ├── builder/page.tsx      # Write resume by hand
│       └── generate/page.tsx     # AI-generate resume from job description
│
├── components/
│   ├── AppShell.tsx              # Sticky nav, layout wrapper for all app pages
│   ├── Logo.tsx                  # InternFlow wordmark + icon
│   ├── HeroGraph.tsx             # Lazy-loads CommitGraph3D with SVG fallback
│   └── CommitGraph3D.tsx         # Rotating 3D git graph (Three.js / R3F)
│
└── lib/
    ├── api.ts                    # Fetch wrapper (attaches JWT, throws on errors)
    ├── auth.ts                   # useAuth hook — user, token, login, logout, refresh
    └── stripe.ts                 # Razorpay helpers — loadRazorpay, initializeRazorpayCheckout
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 8+ or yarn
- Backend API running (default `http://localhost:8000`)

### Installation

```bash
cd apps/web
npm install

# Create environment file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF

npm run dev
```

App runs at **http://localhost:3000**.

### Scripts

```bash
npm run dev    # Development server
npm run build  # Production build
npm start      # Start production server
```

## Authentication Flow

```
User fills in email + password → POST /auth/register or /auth/login
        ↓
Backend returns JWT
        ↓
Token stored in localStorage
        ↓
All API requests: Authorization: Bearer {token}

GitHub OAuth (for the GitHub page):
User clicks "Connect GitHub account"
        ↓
Redirect to {API_URL}/api/github/login
        ↓
Backend completes OAuth, redirects to /github?token=xxx
        ↓
Token written to localStorage; page replaces URL
```

## API Endpoints Used

All requests go to `{NEXT_PUBLIC_API_URL}/api{endpoint}`.

```
Authentication
  POST /api/auth/register              Create account
  POST /api/auth/login                 Sign in → returns { access_token }

GitHub
  GET  /api/github/login               Start OAuth flow (browser redirect)
  GET  /api/github/repos               List connected repositories
  GET  /api/github/contents            Browse repo directory
  GET  /api/github/file                Fetch file content
  POST /api/github/{repo}/auto-setup   Generate README (RAG)

Code Review
  POST /api/v1/review                  Submit code for AI review

Jobs
  GET  /api/jobs/                      List internship postings

Resume
  POST /api/resume/create              Save manual resume
  POST /api/resume/generate            Generate resume → returns PDF blob
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxx
```

## Library Modules

### `lib/api.ts`

Thin fetch wrapper. Every call prepends `/api` to the endpoint and attaches `Authorization: Bearer {token}` from `localStorage`. On non-2xx responses it parses FastAPI's `{ detail }` / `{ message }` error shapes and throws a plain `Error` with the human-readable message. PDF responses are returned as a `Blob`; everything else is parsed as JSON.

```typescript
import { api } from '@/lib/api';

await api.get('/jobs/?limit=50');
await api.post('/auth/login', { email, password });
```

### `lib/auth.ts`

`useAuth()` hook. The JWT is decoded client-side (no `/me` round-trip) — expiry is checked on every read and the token is removed automatically if it has expired. Exposes:

| Field | Type | Description |
|-------|------|-------------|
| `user` | `{ id, email, subscription_tier }` \| `null` | Decoded JWT payload |
| `token` | `string` \| `null` | Raw JWT |
| `loading` | `boolean` | True during initial localStorage read |
| `login(email, password)` | `Promise<void>` | POSTs credentials, stores token, syncs state |
| `logout()` | `void` | Clears token from localStorage and state |
| `refresh()` | `void` | Re-reads localStorage — call after writing a token directly (e.g. GitHub OAuth callback) |

`subscription_tier` values: `'free'` \| `'pro'` \| `'enterprise'`.

State is also kept in sync across browser tabs via the `storage` event.

### `lib/stripe.ts` (Razorpay)

Despite the filename, this module wraps **Razorpay** (not Stripe). It lazy-loads the Razorpay checkout script and opens the payment modal:

```typescript
import { loadRazorpay, initializeRazorpayCheckout } from '@/lib/stripe';

await loadRazorpay(); // injects <script> tag once
initializeRazorpayCheckout({
  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  order_id: '...',
  handler: (response) => { /* verify server-side */ },
  modal: { ondismiss: () => {} },
});
```

## Design System (defined in `globals.css`) rather than raw Tailwind colours. Key tokens:

| Variable | Use |
|----------|-----|
| `--paper` / `--paper-dim` | Page and card backgrounds |
| `--ink` / `--ink-soft` | Primary and secondary text |
| `--indigo` | Brand accent (links, active tab indicator) |
| `--green` | Success / connected status |
| `--line` | Borders and dividers |
| `--font-mono` | Code previews |

Utility classes like `panel`, `panel-dark`, `btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `field`, `field-label`, `eyebrow`, `eyebrow-accent`, `chip`, `chip-green`, `chip-rust`, `chip-muted`, `display`, `nav-link`, and `shell` / `container-xl` are defined in the global stylesheet.

## Contributing

1. Branch: `git checkout -b feature/your-feature`
2. Commit: `git commit -m 'Add your feature'`
3. Push: `git push origin feature/your-feature`
4. Open a Pull Request

### Code Style

- Functional components with hooks
- TypeScript strict mode
- Errors surfaced to the user via inline `chip chip-rust` alerts or `alert()` — no silent failures
- API calls go through `lib/api.ts`; auth state lives in `lib/auth.ts`

## License

MIT — see [LICENSE](../../LICENSE)

---

**Backend API docs:** [services/api/README.md](../../services/api/README.md)  
**Deployment guide:** [docs/DEPLOYMENT_GUIDE.md](../../docs/DEPLOYMENT_GUIDE.md)