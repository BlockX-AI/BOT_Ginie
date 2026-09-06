"use client";

import { useEffect, useMemo, useState } from "react";

type TypingTextProps = {
  lines: string[];
  speed?: number; // ms per character
  pauseBetween?: number; // ms between lines
  className?: string;
  highlightWords?: string[]; // words to render with highlightClassName
  highlightClassName?: string; // tailwind classes applied to highlights
};

export default function TypingText({
  lines,
  speed = 35,
  pauseBetween = 500,
  className,
  highlightWords = [],
  highlightClassName = "text-primary",
}: TypingTextProps) {
  const [rendered, setRendered] = useState<string>("");

  // Build a regex to find highlight words in the progressively rendered text
  const highlightRegex = useMemo(() => {
    if (!highlightWords.length) return null;
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = highlightWords.map(escape).join("|");
    try {
      // Make the regex case-insensitive and match whole words
      return new RegExp(`(\\b${pattern}\\b)`, "gi");
    } catch {
      return null;
    }
  }, [highlightWords]);

  useEffect(() => {
    let mounted = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const full = lines.join("\n");
    let i = 0;

    const tick = () => {
      if (!mounted) return;
      if (i < full.length) {
        setRendered(full.slice(0, i + 1));
        const char = full[i];
        i += 1;
        const delay = char === "\n" ? pauseBetween : speed;
        timeout = setTimeout(tick, delay);
      }
    };

    tick();
    return () => {
      mounted = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [lines, speed, pauseBetween]);

  const content = useMemo(() => {
    if (!highlightRegex) return rendered;
    const parts: Array<string | JSX.Element> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    // Reset regex state in case of re-use
    highlightRegex.lastIndex = 0;
    while ((match = highlightRegex.exec(rendered)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (start > lastIndex) parts.push(rendered.slice(lastIndex, start));
      parts.push(
        <span key={`${start}-${end}`} className={highlightClassName}>
          {match[0]}
        </span>
      );
      lastIndex = end;
    }
    if (lastIndex < rendered.length) parts.push(rendered.slice(lastIndex));
    return parts;
  }, [rendered, highlightRegex, highlightClassName]);

  return (
    <span className={className} style={{ whiteSpace: "pre-line" }}>
      {content}
      <span className="inline-block w-1.5 ml-1 align-baseline animate-pulse bg-orange-500" style={{ height: "1em" }} />
    </span>
  );
}
