import './globals.css';
import type { Metadata } from 'next';
import { Inter, Fraunces, IBM_Plex_Mono } from 'next/font/google';
import { GoogleAnalytics } from '@next/third-parties/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'InternFlow — AI Code Review & Internship Platform',
  description:
    'Connect a repo, get an AI review on every change, and turn the work into a resume that gets you hired.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} font-sans antialiased`}>
        {children}
      </body>

      <GoogleAnalytics gaId="G-2SC90HTR7G" />
    </html>
  );
}