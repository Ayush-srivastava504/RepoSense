# RepoSense Frontend

> Next.js web application for RepoSense — job/internship discovery, an AI resume builder, a LinkedIn Profile Optimizer, and a GitHub repo browser with AI code review, all in one dashboard.

> **Naming note:** this app was previously branded "InternFlow" in older docs. The package name in `package.json` is `internship-web` and some legacy variable/file names still reflect that history (see `lib/stripe.ts` below), but the product is RepoSense throughout the UI.

## Overview

Built with Next.js 14 (App Router), TypeScript, and Tailwind CSS. It provides public job/internship browsing plus an authenticated area (email OTP login) for the resume builder, LinkedIn optimizer, and GitHub tools.

## Features

### Authentication — email OTP, not password
- **Passwordless login**: enter an email, receive a 6-digit OTP, verify it → JWT. There is no password field anywhere in the current UI.
- **Guest sessions**: unauthenticated visitors silently get an anonymous JWT (via `ensureGuestSession()`) so they can save/apply/track jobs before creating an account, unless `NEXT_PUBLIC_REQUIRE_AUTH=true`.
- **Persistent sessions**: JWT stored in `localStorage`, sent as `Authorization: Bearer` on every request; state syncs across tabs via the `storage` event.
- **Protected routes**: pages under `app/(auth)/` are gated by `AuthGuard`.

### GitHub Integration
- **OAuth connect** (optional, separate from login): redirects to the backend's `/api/github/login`, which completes the flow and returns a token via redirect URL.
- **Repository browser**: select a repo, navigate directories, preview file contents.
- **AI Code Review**: send an open file to the backend for review.
- **README Generation**: auto-generate a README for the selected repo via the RAG service.
- **Live terminal**: WebSocket-backed in-browser terminal (`components/github/Terminal.tsx`, xterm.js) for the connected repo.

### Job / Internship Discovery
- Public `jobs/` and `internships/` listing pages plus `[slug]` detail pages — no login required to browse.
- `FeaturedJobs`, `JobCard`, `JobBadges`, `JobDetail`, `SponsoredCard`, and ad slots (`AdSlot`, `InternshipDetailAds`) compose the listing/detail UI.
- `ApplyButton` respects the `requireAuthForApply` feature flag.

### Resume Builder
- `app/(auth)/resume/builder/` — write a resume by hand or generate one from a job description via the backend's AI generation endpoints.

### LinkedIn Profile Optimizer
- `app/(auth)/linkedin/` — premium feature; scores a connected profile and generates suggestions. Gated by subscription tier / ad-unlock, mirroring the backend's quota model.

### Payments
- Razorpay checkout for Pro/Enterprise subscription upgrades.

## Tech Stack

| Tool | Notes |
|---|---|
| **Next.js** | ^14.0.4, App Router |
| **React** | ^18 |
| **TypeScript** | ^5 |
| **Tailwind CSS** | ^3, custom CSS variables in `globals.css` |
| **three / @react-three/fiber / @react-three/drei** | 3D commit graph on the landing page |
| **@xterm/xterm + @xterm/addon-fit** | WebSocket terminal |
| **@next/third-parties** | Analytics/third-party script loading |

Package name in `package.json` is `internship-web`, version `0.1.0`.

## Project Structure

```
apps/web/
├── app/
│   ├── page.tsx                       # Landing page (HeroGraph + marketing copy)
│   ├── about/page.tsx
│   ├── sitemap.ts
│   ├── jobs/page.tsx, jobs/[slug]/page.tsx
│   ├── internships/page.tsx, internships/[slug]/page.tsx
│   ├── components/                    # AdSlot, AppShell, ApplyButton, AuthGuard,
│   │                                   # FeaturedJobs, Footer, HeroGraph,
│   │                                   # InternshipDetailAds, JobBadges, JobCard,
│   │                                   # JobDetail, Logo, SponsoredCard
│   ├── globals.css                    # Design tokens (CSS vars) + utility classes
│   ├── layout.tsx                     # Root layout / auth context
│   └── (auth)/                        # Routes behind AuthGuard
│       ├── login/page.tsx             # Email OTP login (2-step: email → otp)
│       ├── register/page.tsx          # Same OTP flow, framed as account creation
│       ├── dashboard/page.tsx         # Authenticated overview
│       ├── github/page.tsx            # Repo browser + code review + README gen
│       ├── linkedin/page.tsx          # LinkedIn Profile Optimizer
│       └── resume/builder/page.tsx    # Resume builder (single route — there is no separate /resume/generate page)
│
├── components/github/Terminal.tsx     # WebSocket terminal component (note: outside app/, imported directly)
│
└── lib/
    ├── api.ts                         # Fetch wrapper (attaches JWT, throws on parsed error)
    ├── auth.ts                        # useAuth hook (OTP) + ensureGuestSession()
    ├── featureFlags.ts                # NEXT_PUBLIC_REQUIRE_AUTH* gates
    ├── jobs.ts                        # Job-fetching helpers
    ├── slug.ts                        # Slug generation for job/internship URLs
    ├── analytics.ts                   # trackEvent()
    ├── useAuthGate.ts                 # Hook wrapping featureFlags for gated actions
    └── stripe.ts                      # Razorpay helpers, despite the filename — see below
```

There is no `app/login/`, `app/register/`, `app/github/`, `app/dashboard/`, or `app/resume/generate/` at the top level of `app/` — all authenticated pages live under the `app/(auth)/` route group, and resume generation is a mode within `resume/builder/`, not a separate route.

## Getting Started

### Prerequisites
- Node.js 18+
- npm 8+ (matches the committed `package-lock.json`... actually there is none committed for `apps/web` — run `npm install` fresh)
- Backend Core API running (default `http://localhost:8000`)

### Installation

```bash
cd apps/web
npm install

cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxx
NEXT_PUBLIC_REQUIRE_AUTH=false
EOF

npm run dev
```

App runs at **http://localhost:3000**.

### Scripts

```bash
npm run dev     # Development server
npm run build   # Production build
npm start       # Start production server
```

There is no `npm test` or `npm run lint` script currently defined in `package.json` — only `dev`, `build`, and `start`. If contribution guidelines elsewhere mention linting or tests, add the scripts first.

## Authentication Flow

```
User enters email → POST /auth/otp/request
        ↓
User enters the 6-digit code → POST /auth/otp/verify
        ↓
Backend returns { access_token }
        ↓
Token stored in localStorage; useAuth() decodes it client-side (no /me round-trip)
        ↓
All API requests: Authorization: Bearer {token}

Unauthenticated visitors (guest sessions):
AuthGuard-protected pages call ensureGuestSession()
        ↓
POST /auth/guest → anonymous { access_token } stored the same way
        ↓
No-ops if NEXT_PUBLIC_REQUIRE_AUTH=true or a token already exists

GitHub OAuth (separate, optional — for the GitHub page only):
User clicks "Connect GitHub account"
        ↓
Redirect to {API_URL}/api/github/login
        ↓
Backend completes OAuth, redirects to /github?token=xxx
        ↓
Token written to localStorage; page replaces the URL
```

## API Endpoints Used

All requests go to `{NEXT_PUBLIC_API_URL}/api{endpoint}`.

```
Auth
  POST /api/auth/otp/request           Send OTP
  POST /api/auth/otp/verify             Verify OTP → { access_token }
  POST /api/auth/guest                  Anonymous session

GitHub
  GET  /api/github/login                Start OAuth flow (browser redirect)
  GET  /api/github/repos                List connected repositories
  GET  /api/github/contents             Browse repo directory
  GET  /api/github/file                 Fetch file content
  POST /api/github/{owner}/{repo}/auto-setup   Generate README (RAG)
  POST /api/github/terminal/token       Terminal session token

Code Review
  POST /api/v1/review                   Submit code for AI review

Jobs
  GET  /api/jobs/                       List jobs
  GET  /api/jobs/featured               Featured jobs

Resume
  POST /api/resume/create               Save manual resume
  POST /api/resume/generate             AI-generate resume content
  POST /api/resume/generate-structured  Structured generation

LinkedIn
  GET  /api/linkedin/status
  POST /api/linkedin/analyze
  GET  /api/linkedin/history

Subscription
  POST /api/subscription/create-checkout
```

There is no `POST /api/auth/register` or `POST /api/auth/login` (password-based) call anywhere in the frontend — those referenced in older docs describe an auth system this app no longer implements.

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxx
NEXT_PUBLIC_REQUIRE_AUTH=false
NEXT_PUBLIC_REQUIRE_AUTH_FOR_APPLY=false
NEXT_PUBLIC_REQUIRE_AUTH_FOR_SAVE=true          # default true (gate unless explicitly disabled)
NEXT_PUBLIC_REQUIRE_AUTH_FOR_TRACKING=true      # default true
NEXT_PUBLIC_REQUIRE_AUTH_FOR_RECOMMENDATIONS=true  # default true
```

See `lib/featureFlags.ts` for exact default logic per flag (they aren't all "default false" — three of the five default to gated/`true`).

## Library Modules

### `lib/api.ts`
Fetch wrapper. Prepends `/api` to the endpoint and attaches `Authorization: Bearer {token}` from `localStorage`. Parses FastAPI's `{ detail }` / `{ message }` error shapes into a plain `Error`. PDF responses are returned as a `Blob`; everything else is parsed as JSON.

```typescript
import { api } from '@/lib/api';

await api.get('/jobs/?limit=50');
await api.post('/auth/otp/request', { email });
```

### `lib/auth.ts`
`useAuth()` hook exposing:

| Field | Type | Description |
|---|---|---|
| `user` | `{ id, email, subscription_tier, is_guest? }` \| `null` | Decoded JWT payload |
| `token` | `string` \| `null` | Raw JWT |
| `loading` | `boolean` | True during initial `localStorage` read |
| `requestOtp(email)` | `Promise<void>` | Step 1 — triggers the OTP email |
| `verifyOtp(email, otp)` | `Promise<void>` | Step 2 — exchanges OTP for a JWT, stores it |
| `logout()` | `void` | Clears token from `localStorage` and state |
| `refresh()` | `void` | Re-reads `localStorage` — call after writing a token directly (e.g. the GitHub OAuth callback) |

Also exports `ensureGuestSession()` (not part of the hook) — call it only at the point a page actually needs a token (inside `AuthGuard`), not from every page render, or every page view would mint a DB row.

`subscription_tier` values: `'free'` \| `'pro'` \| `'enterprise'`.

### `lib/stripe.ts` (Razorpay)
Despite the filename, this module wraps **Razorpay**, not Stripe — a naming holdover from before migration `007_migrate_stripe_to_razorpay.sql`. Renaming the file would be a reasonable but purely cosmetic cleanup.

```typescript
import { loadRazorpay, initializeRazorpayCheckout } from '@/lib/stripe';

await loadRazorpay(); // injects the Razorpay checkout <script> once
initializeRazorpayCheckout({
  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  order_id: '...',
  handler: (response) => { /* verify server-side */ },
  modal: { ondismiss: () => {} },
});
```

## Design System

Defined in `globals.css` as CSS custom properties rather than raw Tailwind colors:

| Variable | Use |
|---|---|
| `--paper` / `--paper-dim` | Page and card backgrounds |
| `--ink` / `--ink-soft` | Primary and secondary text |
| `--indigo` | Brand accent (links, active tab indicator) |
| `--green` | Success / connected status |
| `--line` | Borders and dividers |
| `--font-mono` | Code previews |

Utility classes: `panel`, `panel-dark`, `btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `field`, `field-label`, `eyebrow`, `eyebrow-accent`, `chip`, `chip-green`, `chip-rust`, `chip-muted`, `display`, `nav-link`, `shell`, `container-xl`.

## Contributing

1. Branch: `git checkout -b feature/your-feature`
2. Commit: `git commit -m 'Add your feature'`
3. Push: `git push origin feature/your-feature`
4. Open a Pull Request

### Code Style
- Functional components with hooks
- TypeScript strict mode
- Errors surfaced via inline `chip chip-rust` alerts or `alert()` — no silent failures
- API calls go through `lib/api.ts`; auth state lives in `lib/auth.ts`

## License

MIT — see [LICENSE](../../LICENSE)

---

**Backend API docs:** [services/api/README.md](../../services/api/README.md)
**Deployment guide:** [docs/DEPLOYMENT_GUIDE.md](../../docs/DEPLOYMENT_GUIDE.md)