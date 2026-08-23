# apps/web — Frontend

Next.js (App Router, TypeScript, Tailwind) frontend for RepoSense: job,
internship, remote-job, government-job, and hackathon listings, plus the
authenticated tools (resume builder, ATS checker, LinkedIn analyzer, GitHub
terminal, LeetCode practice, application tracker).

## Structure

```
app/
  page.tsx, layout.tsx        Root page and layout
  jobs/, internships/,
  remote-jobs/, europe-jobs/,
  japan-jobs/, government-jobs/  Listing + detail pages per job category
  companies/                     Company directory
  hackathons/                    Hackathon listing + detail
  blog/                           Blog listing + detail (content-driven)
  tools/                          Standalone utility tools
  tracker/                        Application tracker board
  (auth)/                         Authenticated tools: login, register,
                                    dashboard, resume builder, ATS checker,
                                    cover letter, LinkedIn, GitHub, LeetCode
  sitemap*.xml/                   Dynamically generated sitemaps
  components/                     Shared UI components
components/github/                GitHub-connected terminal component
lib/                              API client, auth, feature flags, analytics,
                                   slug/time helpers, structured data, etc.
content/blog/, content/seo/        Blog post JSON and SEO keyword data
public/                            Static assets, service worker
```

## Running locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start   # production build
```

By default the app talks to the core API at `http://localhost:8000`; set
`NEXT_PUBLIC_API_URL` (or `NEXT_PUBLIC_API_BASE_URL`) to point elsewhere.

## Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_API_BASE_URL` / `API_BASE_URL` | Core API base URL |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay checkout key for subscriptions |
| `NEXT_PUBLIC_LOGO_DEV_TOKEN` | Token for company logo lookups |
| `NEXT_PUBLIC_REQUIRE_AUTH` | Global auth-required toggle |
| `NEXT_PUBLIC_REQUIRE_AUTH_FOR_APPLY` / `..._FOR_SAVE` / `..._FOR_TRACKING` / `..._FOR_RECOMMENDATIONS` | Per-feature auth gates |

## Content generation

`npm run seo:generate` runs `scripts/generate-daily-posts.mjs` (repo root) to
generate new blog post JSON files under `content/blog/`.
