import { useState, useEffect } from "react";
import { AVATARS, type Avatar } from "@/data/avatars";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const AVATARS_API = `${window.location.origin}${BASE}/api/avatars`;

export function useAvatars(): Avatar[] {
  const [combined, setCombined] = useState<Avatar[]>(AVATARS);

  useEffect(() => {
    fetch(AVATARS_API)
      .then(r => r.ok ? r.json() : [])
      .then((custom: { emoji: string; label: string }[]) => {
        if (!Array.isArray(custom) || custom.length === 0) return;
        const existing = new Set(AVATARS.map(a => a.emoji));
        const extras = custom.filter(c => !existing.has(c.emoji)).map(c => ({ emoji: c.emoji, label: c.label }));
        if (extras.length > 0) setCombined([...AVATARS, ...extras]);
      })
      .catch(() => {});
  }, []);

  return combined;
}
