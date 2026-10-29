// src/hooks/useIdleLogout.js
//
// Signs the admin out after a period of no activity.
// The time limit is chosen in Settings > Account & Security and saved in this browser.
import { useEffect, useRef } from "react";

export const SESSION_TIMEOUT_KEY = "session_timeout_minutes";   // "0" or missing = never

export function useIdleLogout(onLogout) {
  const logoutRef = useRef(onLogout);
  useEffect(() => { logoutRef.current = onLogout; }, [onLogout]);

  useEffect(() => {
    let lastActive = Date.now();
    const markActive = () => { lastActive = Date.now(); };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const timer = setInterval(() => {
      let minutes = 0;
      try { minutes = Number(localStorage.getItem(SESSION_TIMEOUT_KEY)) || 0; } catch { /* storage blocked */ }
      if (minutes > 0 && Date.now() - lastActive > minutes * 60 * 1000) {
        logoutRef.current();
      }
    }, 15000);

    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, markActive));
    };
  }, []);
}