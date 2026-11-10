"use client";

import { useEffect, useRef, useState } from "react";

export function OverviewAddress({ address }: { address: string }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(address);
      setMessage("Copied!");
    } catch {
      setMessage("Could not copy. Select the address and copy manually.");
    }
    timer.current = setTimeout(() => setMessage(""), 3000);
  }

  return <span className="overview-copy-wrap">
    <button type="button" className="overview-address overview-copy" title="Copy wallet address" aria-label={`Copy wallet address ${address}`} onClick={() => { void copy(); }}>{address}</button>
    <span className={`overview-copy-status${message ? " visible" : ""}`} role="status">{message}</span>
  </span>;
}
