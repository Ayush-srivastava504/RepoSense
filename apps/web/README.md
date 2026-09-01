# RepoSense Web Frontend (`apps/web`)

The Next.js 14 frontend for the RepoSense platform. Built with React 18, TypeScript, Tailwind CSS, and the App Router. It serves as both the public marketing/SEO engine and the authenticated web workspace for job applicants and developers.

---

## 🚀 Key Features

- **App Router Architecture**: Optimized server-side rendering (SSR) and static site generation (SSG) with incremental static regeneration (`revalidate = 3600`).
- **Full Internationalization (i18n)**: Out-of-the-box support for **9 global locales**:
  - `en` (English - default)
  - `es` (Español)
  - `ja` (日本語)
  - `fr` (Français)
  - `de` (Deutsch)
  - `pt` (Português)
  - `ko` (한국어)
  - `it` (Italiano)
  - `hi` (हिन्दी)
- **Interactive Language Switcher**: Persistent cookie-based (`NEXT_LOCALE`) switching and automatic browser language detection via Next.js middleware.
- **Modern Career Tools**:
  - AI Resume Builder & LaTeX generator
  - ATS Keyword & Formatting Checker
  - Tailored Cover Letter Generator
  - AI GitHub Code Reviewer & README Generator
  - LinkedIn Profile Optimizer
  - In-Browser xterm.js Terminal
  - Interactive LeetCode Problem Judge
- **Programmatic SEO Engine**: Automated generation of localized blog guides, company profiles, skill hubs, city directories, and high-performance multi-part sitemaps.

---

## 📂 Directory Layout

```
apps/web/
├── app/
│   ├── (auth)/                # Authenticated flows: login, register, dashboard
│   ├── blog/                  # Blog index and dynamic [slug] article pages
│   ├── careers/               # Role-specific career roadmap hubs
│   ├── companies/             # Company directory & profile pages
│   ├── europe-jobs/           # European jobs & visa sponsorship listings
│   ├── government-jobs/       # Public sector & government job notifications
│   ├── hackathons/            # Hackathon discovery feed
│   ├── internships/           # College & fresher internship portal
│   ├── japan-jobs/            # Japan tech job & internship listings
│   ├── jobs/                  # Primary paginated job search feed
│   ├── jobs-in/               # City-specific job directories
│   ├── remote-jobs/           # Global remote job listings
│   ├── resume-for/            # Resume guides per tech role
│   ├── skills/                # Skill-specific job listings
│   ├── tools/                 # Marketing landing pages for AI tools
│   ├── tracker/               # Kanban application tracking board
│   ├── layout.tsx             # Root layout with Schema.org & hreflang tags
│   └── page.tsx               # Main landing page
├── components/
│   ├── AppShell.tsx           # Layout wrapper with sidebar and header
│   ├── Sidebar.tsx            # Collapsible navigation with LanguageSwitcher
│   ├── LanguageSwitcher.tsx   # Dropdown component with flags & native names
│   ├── JobCard.tsx            # Individual job listing display
│   ├── FAQAccordion.tsx       # Interactive FAQ accordion
│   └── github/                # xterm.js terminal integration
├── content/
│   ├── blog/                  # JSON blog post storage
│   │   ├── *.json             # English source blog posts
│   │   ├── es/                # Spanish blog translations
│   │   ├── ja/                # Japanese blog translations
│   │   ├── fr/                # French blog translations
│   │   ├── de/                # German blog translations
│   │   ├── pt/                # Portuguese blog translations
│   │   ├── ko/                # Korean blog translations
│   │   ├── it/                # Italian blog translations
│   │   └── hi/                # Hindi blog translations
│   └── seo/
│       └── keywords.json      # Programmatic SEO keyword queue & tracker
├── i18n/
│   ├── config.ts              # Supported locales and metadata
│   ├── get-dictionary.ts      # Lazy JSON dictionary loader
│   └── dictionaries/          # 9 locale UI translation files
├── lib/
│   ├── blog.ts                # Locale-aware blog querying & schemas
│   ├── jobs.ts                # API client for job search & caching
│   ├── auth.ts                # Authentication hooks & token handling
│   ├── tracker.ts             # Application tracking state management
│   └── structuredData.ts      # Schema.org JSON-LD generators
└── middleware.ts              # Locale detection & routing rewrite middleware
```

---

## 🛠️ Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build & Start
```bash
npm run build
npm run start
```

---

## ⚙️ Environment Variables

Create `.env.local` in the `apps/web/` directory:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base URL for the FastAPI backend | `http://localhost:8000` |
| `NEXT_PUBLIC_LOGO_DEV_TOKEN` | Logo.dev API token for company branding | `""` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key for payments | `""` |
| `NEXT_PUBLIC_REQUIRE_AUTH` | Require login across all features | `false` |

---

## 📝 Adding New Blog Posts & Translations

1. **Create an English Post**: Add a JSON file in `content/blog/your-post-slug.json`:
   ```json
   {
     "slug": "your-post-slug",
     "title": "Your Title",
     "description": "Short meta description under 160 characters.",
     "keyword": "target keyword",
     "category": "ai-engineer",
     "publishedAt": "2026-09-01T10:00:00.000Z",
     "readingTime": "6 min read",
     "tags": ["AI", "Career"],
     "body": "Your article body with ## headers and - bullets.\n\n## Section 1\n\nContent...",
     "faq": [
       {"q": "Common question?", "a": "Direct answer."}
     ]
   }
   ```
2. **Add Localized Versions**: Create corresponding files under `content/blog/es/`, `content/blog/ja/`, `content/blog/fr/`, etc. The system will automatically serve the localized version when requested with fallback to English.
