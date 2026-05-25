#  Repo Sense Frontend

> Modern Next.js web application for the RepoSense AI Platform. Provides a comprehensive dashboard for code reviews, job discovery, resume analysis, and GitHub repository management.

## Overview

The RepoSense frontend is a full-featured Next.js 14+ application built with TypeScript and Tailwind CSS. It connects users with intelligent job matching, AI-powered resume analysis, GitHub repository browsing, and real-time code review insights through an intuitive, responsive interface.

## Features

### User Management
- **GitHub OAuth 2.0 Login**: Single sign-on via GitHub
- **User Dashboard**: Personalized workspace with quick actions
- **Subscription Tiers**: Free and Premium feature access
- **Profile Management**: Update preferences and account settings

### Job Discovery & Matching
- **Job Search**: Filter across 9+ aggregated job boards
- **Smart Matching**: AI-powered job recommendations based on resume
- **Job Details**: Full job descriptions with company info
- **One-Click Application**: Direct links to apply

### Resume Intelligence
- **Resume Upload**: Support for PDF, DOC, DOCX formats
- **Resume Parsing**: AI extracts skills, experience, education
- **Resume Matching**: Compare resume against job listings
- **Resume Analytics**: Skill gap analysis & suggestions

### GitHub Integration
- **Repository Browser**: Browse connected GitHub repositories
- **File Viewer**: View source code with syntax highlighting
- **Auto-README Generation**: AI-powered README creation using RAG
- **WebSocket Terminal**: Execute code in sandboxed environment

### Code Review
- **Submit for Review**: Send code snippets or files
- **AI Analysis**: Instant bug detection & quality issues
- **Auto-Fix Suggestions**: Generated fixes with confidence scores
- **Historical Reviews**: View past code analysis results

### Payments & Subscriptions
- **Stripe Integration**: Secure payment processing
- **Free Tier**: Limited reviews and features
- **Premium Tier**: Unlimited access with priority support
- **Subscription Management**: Upgrade/downgrade anytime

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| **Next.js** | 14+ | React framework with SSR/SSG |
| **React** | 18+ | UI component library |
| **TypeScript** | 5+ | Static typing for JavaScript |
| **Tailwind CSS** | 3+ | Utility-first CSS framework |
| **Next/Auth** | 5+ | Authentication & session management |
| **Axios / Fetch API** | - | HTTP client for API communication |
| **Stripe.js** | - | Payment integration |
| **WS (WebSocket)** | - | Real-time terminal communication |

##  Project Structure

```
apps/web/
├── README.md                          # Frontend documentation (this file)
├── package.json                       # Dependencies & scripts
├── tsconfig.json                      # TypeScript configuration
├── next.config.js                     # Next.js configuration
├── tailwind.config.js                 # Tailwind CSS config
├── postcss.config.js                  # PostCSS plugins
│
├── app/                               # Next.js App Router (v13+)
│   ├── layout.tsx                     # Root layout with providers
│   ├── page.tsx                       # Home landing page
│   ├── globals.css                    # Global styles
│   │
│   └── (auth)/                        # Protected route group
│       ├── dashboard/
│       │   ├── page.tsx               # Main dashboard
│       │   └── layout.tsx             # Dashboard layout
│       ├── github/
│       │   ├── page.tsx               # GitHub repos & browser
│       │   └── layout.tsx             # GitHub context layout
│       ├── jobs/
│       │   ├── page.tsx               # Job search & listings
│       │   └── [id]/
│       │       └── page.tsx           # Job details page
│       ├── resume/
│       │   ├── page.tsx               # Resume upload & management
│       │   └── [id]/
│       │       └── page.tsx           # Resume details & analysis
│       ├── login/
│       │   └── page.tsx               # GitHub OAuth login
│       ├── register/
│       │   └── page.tsx               # User registration
│       └── profile/
│           └── page.tsx               # User profile settings
│
├── components/                        # Reusable React components
│   ├── github/
│   │   ├── Terminal.tsx               # WebSocket terminal
│   │   ├── RepoSelector.tsx           # Repo browser dropdown
│   │   └── FileViewer.tsx             # Source code viewer
│   ├── jobs/
│   │   ├── JobCard.tsx                # Individual job card
│   │   ├── JobFilter.tsx              # Search filters
│   │   └── MatchingScore.tsx          # Match percentage display
│   ├── resume/
│   │   ├── ResumeUpload.tsx           # Drag-and-drop uploader
│   │   ├── ResumePreview.tsx          # Resume display
│   │   └── SkillsAnalysis.tsx         # Skills breakdown
│   ├── auth/
│   │   ├── AuthProvider.tsx           # Context provider for auth
│   │   ├── ProtectedRoute.tsx         # Route protection wrapper
│   │   └── LoginButton.tsx            # GitHub login button
│   ├── common/
│   │   ├── Header.tsx                 # Navigation header
│   │   ├── Footer.tsx                 # Footer component
│   │   ├── Sidebar.tsx                # Side navigation
│   │   ├── Loading.tsx                # Spinner/skeleton
│   │   ├── ErrorBoundary.tsx          # Error handling
│   │   └── Modal.tsx                  # Modal dialog
│   └── review/
│       ├── CodeReviewForm.tsx         # Submit code for review
│       ├── ReviewResults.tsx          # Display analysis results
│       └── AutofixPreview.tsx         # Show generated fixes
│
├── lib/                               # Utility functions & hooks
│   ├── api.ts                         # API client instance
│   │   ├── authenticate()             # Auth with JWT
│   │   ├── submitCode()               # Submit review request
│   │   ├── searchJobs()               # Search jobs
│   │   ├── uploadResume()             # Upload resume
│   │   └── ...
│   ├── auth.ts                        # Auth utilities
│   │   ├── signIn()                   # GitHub OAuth flow
│   │   ├── signOut()                  # Clear session
│   │   ├── getToken()                 # Retrieve JWT
│   │   └── isAuthenticated()          # Check auth status
│   ├── stripe.ts                      # Stripe integration
│   │   ├── createCheckoutSession()    # Create Stripe session
│   │   ├── getCustomerPortal()        # Billing management
│   │   └── validateSubscription()     # Check tier
│   ├── hooks/
│   │   ├── useAuth.ts                 # Auth context hook
│   │   ├── useJob.ts                  # Job search hook
│   │   ├── useResume.ts               # Resume management hook
│   │   ├── useFetch.ts                # Generic fetch hook
│   │   └── useLocalStorage.ts         # Browser storage hook
│   └── constants.ts                   # API URLs, constants
│
├── public/                            # Static assets
│   ├── logo.svg
│   ├── favicon.ico
│   └── images/
│       └── ...
│
└── styles/                            # Additional stylesheets
    ├── globals.css                    # Global Tailwind
    └── animations.css                 # Custom animations
```

## Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** 8+ or **yarn**
- **Backend API** running on `http://localhost:8000`

### Installation

```bash
# Navigate to frontend directory
cd apps/web

# Install dependencies
npm install

# Create environment file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxx
GITHUB_CLIENT_ID=your_github_app_id
GITHUB_CLIENT_SECRET=your_github_app_secret
EOF

# Start development server
npm run dev
```

**Application running at:** http://localhost:3000

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm start         # Start production server
npm run lint      # Run ESLint
npm run type-check # TypeScript type checking
npm run format    # Format code with Prettier
```

## Authentication Flow

```
User clicks "Login with GitHub"
         ↓
Browser redirects to /api/auth/github/login (backend)
         ↓
Backend exchanges code for GitHub token
         ↓
Backend creates JWT token
         ↓
Frontend receives token in URL: http://localhost:3000/github?token=xxx
         ↓
Token stored in localStorage
         ↓
All API requests include: Authorization: Bearer {token}
```

## API Integration

### Base Configuration

```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });
    
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  }
};
```

### Example API Calls

```typescript
// Submit code for review
const reviewResults = await apiClient.request('/api/review/submit', {
  method: 'POST',
  body: JSON.stringify({ code, language: 'python' })
});

// Search jobs
const jobs = await apiClient.request('/api/jobs/search?query=python&location=Bangalore');

// Upload resume
const formData = new FormData();
formData.append('file', resumeFile);
const resume = await apiClient.request('/api/resume/upload', {
  method: 'POST',
  body: formData
});
```

## Styling

### Tailwind CSS

The project uses Tailwind CSS for styling. All components use utility classes:

```tsx
export default function Button() {
  return (
    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
      Click me
    </button>
  );
}
```

### Custom Styles

Add custom CSS to `styles/globals.css`:

```css
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700;
  }
}
```

## Testing

```bash
# Run tests (if configured)
npm run test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Docker

```bash
# Build image
docker build -t repo-sense-web .

# Run container
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://api:8000 repo-sense-web
```

## Key Pages & Workflows

### Dashboard
- Welcome message with quick actions
- Recent reviews summary
- Job recommendations
- Profile quick links

### GitHub Integration
- List connected repositories
- Browse repository files
- View code with syntax highlighting
- Execute code in WebSocket terminal
- Generate README with RAG

### Job Search
- Full-text search across 9+ boards
- Filters: Location, salary, experience level
- AI-powered match score with resume
- One-click application links

### Resume Management
- Upload multiple resume versions
- Automatic parsing & skill extraction
- Match analysis against jobs
- Download parsed resume as JSON

### Code Review
- Paste or upload code
- Select programming language
- View AI analysis results
- Review auto-fix suggestions
- Save reviews to history

### Subscription
- Display current tier (Free/Premium)
- Premium upgrade button
- Stripe checkout integration
- Manage subscription via Stripe portal

## Contributing

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open a Pull Request

### Code Style

- Follow TypeScript strict mode
- Use functional components with hooks
- Implement proper error handling
- Add TypeScript types to functions
- Write clean, readable code

## License

MIT License – see [LICENSE](../../LICENSE)

---

**For backend API documentation**, see [services/api/README.md](../../services/api/README.md)  
**For deployment instructions**, see [docs/DEPLOYMENT_GUIDE.md](../../docs/DEPLOYMENT_GUIDE.md)
Authentication
  POST /api/auth/register              Register new user
  POST /api/auth/login                 Login (email/password)
  GET  /api/github/login               OAuth login
  GET  /api/github/callback            OAuth callback

GitHub Integration
  GET  /api/github/repos               List repositories
  GET  /api/github/contents            Get repo file structure
  GET  /api/github/file                Get file content
  POST /api/github/index-repo          Index repo for RAG
  POST /api/github/{repo}/auto-setup   Generate README

Code Review
  POST /api/review                     Submit code for review
  GET  /api/review/{id}                Get review results

Resumes
  POST /api/resume/upload              Upload resume
  GET  /api/resume/analyze             AI analysis

Jobs
  GET  /api/jobs                       List jobs
  POST /api/jobs/apply                 Apply for job

Subscriptions
  GET  /api/subscription/status        Check subscription
  POST /api/subscription/upgrade       Upgrade plan
```

##  Environment Variables

Create `.env.local`:

```bash
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Stripe (for payments)
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxxx

# GitHub OAuth (optional)
NEXT_PUBLIC_GITHUB_CLIENT_ID=xxxx
NEXT_PUBLIC_GITHUB_REDIRECT_URI=http://localhost:3000/api/github/callback
```

##  Key Components

### Terminal Component (`components/github/Terminal.tsx`)

WebSocket-based terminal for sandboxed code execution:

```typescript
<Terminal 
  repoId="owner/repo"
  sessionId="session-123"
/>
```

### Auth Context

Wraps entire app with authentication:

```typescript
// In layout.tsx
<AuthProvider>
  {children}
</AuthProvider>
```

Provides:
- Current user info
- JWT token management
- Login/logout
- Protected routes

##  Styling

Uses **Tailwind CSS** with custom theme (see `tailwind.config.js`)

##  Page Routes

| Route | Purpose |
|-------|---------|
| `/` | Home page |
| `/login` | GitHub OAuth login |
| `/register` | User registration |
| `/github/callback` | OAuth callback |
| `/dashboard` | Main dashboard |
| `/jobs` | Job listings |
| `/resume` | Resume upload |

##  Building for Production

```bash
# Build the app
npm run build

# Start production server
npm start

# Or deploy to Vercel
vercel deploy
```

##  Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)

##  Support

Check:
1. Backend API logs (`http://localhost:8000/docs`)
2. Browser console (F12)
3. Network tab in DevTools
4. `.env.local` configuration

##  License

Part of Repo Sense project
