'use client';
import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function Terminal({ repoId }: { repoId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { token } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const WS_URL = API_URL.replace('http', 'ws');

  useEffect(() => {
    if (!terminalRef.current || typeof window === 'undefined') return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      theme: { background: '#1e1e1e', foreground: '#fff' }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    api.post('/github/terminal/token', {})
      .then(({ token: wsToken }) => {
        const ws = new WebSocket(`${WS_URL}/api/github/terminal?token=${wsToken}`);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'terminal:start', repoId }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === 'session:started') {
            setSessionId(msg.sessionId);
          }

          if (msg.type === 'terminal:output') {
            term.write(msg.data);
          }
        };

        ws.onerror = () => {
          term.write('\r\n\x1b[31mWebSocket error\x1b[0m\r\n');
        };
      })
      .catch(console.error);

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && sessionId) {
        wsRef.current.send(
          JSON.stringify({
            type: 'terminal:command',
            sessionId,
            command: data
          })
        );
      }
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      wsRef.current?.close();
      term.dispose();
    };
  }, [repoId, WS_URL, sessionId]);

  return <div className="h-96 border rounded" ref={terminalRef} />;
}