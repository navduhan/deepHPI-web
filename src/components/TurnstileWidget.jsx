"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

export default function TurnstileWidget({ siteKey, onToken, resetKey }) {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const renderWidget = useCallback(() => {
    if (!siteKey || !loaded || !containerRef.current || !window.turnstile || widgetRef.current) return;
    widgetRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
      theme: "light",
    });
  }, [loaded, onToken, siteKey]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [renderWidget]);

  useEffect(() => {
    if (resetKey > 0 && widgetRef.current && window.turnstile) window.turnstile.reset(widgetRef.current);
  }, [resetKey]);

  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={() => setLoaded(true)} />
      <div ref={containerRef} className="min-h-[65px]" aria-label="Anti-bot verification" />
    </>
  );
}
