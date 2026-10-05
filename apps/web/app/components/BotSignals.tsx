'use client';
// apps/web/app/components/BotSignals.tsx
// Frontend-only bot detection. Checks the browser for automation/headless signs and
// reports the result to GA4 (which you already use). No server changes, no IPs collected.
//
// What you will see in GA4:
//   * Realtime overview > "Active users by User property"  -> bot_risk = high / medium / low
//   * Realtime overview > "Event count by Event name"      -> bot_suspect (only for risky visits)
//   * Event parameters on bot_suspect: bot_score, bot_reasons, tz, lang
import { useEffect } from 'react';

type Result = { score: number; reasons: string[] };

function webglRenderer(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch {
    return '';
  }
}

function staticChecks(): Result {
  const reasons: string[] = [];
  let score = 0;
  const add = (pts: number, why: string) => { score += pts; reasons.push(why); };
  const n = navigator as any;
  const ua = n.userAgent || '';
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(ua);

  if (n.webdriver === true) add(60, 'webdriver');
  if (/HeadlessChrome|PhantomJS|Selenium|Puppeteer|Playwright/i.test(ua)) add(60, 'headless_ua');
  if (!n.languages || n.languages.length === 0) add(30, 'no_languages');
  if (/Chrome\//.test(ua) && !isMobile && !(window as any).chrome) add(25, 'fake_chrome');
  if (!isMobile && n.plugins && n.plugins.length === 0) add(15, 'no_plugins');
  if (!screen.width || !screen.height || window.outerWidth === 0) add(30, 'zero_screen');
  if (/swiftshader|llvmpipe|software/i.test(webglRenderer())) add(30, 'software_gl');
  const m = ua.match(/Chrome\/(\d+)/);
  if (m && Number(m[1]) < 100) add(25, 'old_chrome');
  return { score, reasons };
}

export default function BotSignals() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('bs_sent')) return; // once per session
    } catch { /* storage blocked: fine */ }

    let interacted = false;
    const mark = () => { interacted = true; };
    const evts = ['mousemove', 'scroll', 'touchstart', 'keydown', 'click'];
    evts.forEach((e) => window.addEventListener(e, mark, { passive: true, once: true }));

    const send = (r: Result) => {
      const gtag = (window as any).gtag as undefined | ((...a: any[]) => void);
      if (!gtag) return false;
      const risk = r.score >= 60 ? 'high' : r.score >= 30 ? 'medium' : 'low';
      gtag('set', 'user_properties', { bot_risk: risk });
      if (risk !== 'low') {
        gtag('event', 'bot_suspect', {
          bot_score: r.score,
          bot_reasons: r.reasons.join(',').slice(0, 100),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
          lang: (navigator.language || '').slice(0, 10),
        });
      }
      try { sessionStorage.setItem('bs_sent', '1'); } catch { /* ignore */ }
      return true;
    };

    const base = staticChecks();
    let timer: ReturnType<typeof setTimeout>;
    const attempt = (r: Result, tries = 0) => {
      if (send(r)) return;
      if (tries < 20) timer = setTimeout(() => attempt(r, tries + 1), 500); // wait for gtag to load
    };

    if (base.score >= 60) {
      attempt(base); // strong evidence, report right away
    } else {
      // otherwise wait 8s: a real person nearly always moves/scrolls/taps in that time
      timer = setTimeout(() => {
        const r = { score: base.score, reasons: [...base.reasons] };
        if (!interacted) { r.score += 25; r.reasons.push('no_interaction_8s'); }
        attempt(r);
      }, 8000);
    }
    return () => {
      clearTimeout(timer);
      evts.forEach((e) => window.removeEventListener(e, mark));
    };
  }, []);

  return null;
}
