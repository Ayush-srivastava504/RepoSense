#  Repo Sense Frontend

A modern Next.js-based web application for the AI Code Review Platform. Provides a user-friendly interface for code review, repository management, resume analysis, and job tracking.

## Features

- **GitHub Integration**: OAuth login and repository browser
- **Code Review Dashboard**: View AI-powered code analysis results
- **Repository Management**: Browse and manage connected GitHub repositories
- **Resume Upload & Analysis**: Upload resumes for AI-powered analysis
- **Job Tracking**: Track internships and job opportunities
- **Subscription Management**: Free and premium tier support
- **Real-time WebSocket Terminal**: Execute code in sandboxed environment
- **Responsive Design**: Works on desktop, tablet, and mobile

##  Tech Stack

- **Framework**: Next.js 14+ (React)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Built-in + custom
- **API Client**: Fetch API
- **Authentication**: JWT tokens
- **State Management**: React Hooks + Context API

##  Project Structure

```
apps/web/
├── app/                          # Next.js app directory
│   ├── layout.tsx               # Root layout with auth provider
│   ├── page.tsx                 # Home page
│   ├── globals.css              # Global styles
│   ├── (auth)/                  # Authentication routes
│   │   ├── login/               # GitHub OAuth login
│   │   ├── register/            # User registration
│   │   ├── github/              # GitHub callback handler
│   │   ├── dashboard/           # Main dashboard
│   │   ├── jobs/                # Jobs page
│   │   └── resume/              # Resume upload page
├── components/
│   └── github/
│       └── Terminal.tsx         # WebSocket terminal component
├── lib/
│   ├── api.ts                   # API client with authentication
│   ├── auth.ts                  # Authentication utilities
│   └── stripe.ts                # Stripe payment integration
├── public/                       # Static assets
├── next.config.js               # Next.js configuration
├── tailwind.config.js           # Tailwind configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies
```

##  Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running on `http://localhost:8000`

### Installation

```bash
# Navigate to frontend directory
cd apps/web

# Install dependencies
npm install

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxx
EOF

# Start development server
npm run dev
```

Access the app at: **http://localhost:3000**

##  API Integration

### Authentication Flow

```
1. User clicks "Login with GitHub"
2. Redirected to: GET /api/github/login
3. GitHub redirects to: GET /api/github/callback?code=xxx&state=xxx
4. Backend exchanges code for access token
5. Backend returns JWT token in URL: http://localhost:3000/github?token=xxx
6. Token stored in localStorage
7. All requests include: Authorization: Bearer {token}
```

### Key API Endpoints

```
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
