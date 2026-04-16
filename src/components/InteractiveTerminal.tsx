"use client";

import { useRef, useState, useEffect, CSSProperties } from "react";
import { CakeSlice } from "lucide-react";

interface ThemeStyles {
  container: CSSProperties;
  header: CSSProperties;
  output: CSSProperties;
  button: CSSProperties;
  prompt: CSSProperties;
  accentColor: string;
}

const DOTS = { r: "#ff5f57", y: "#ffbd2e", g: "#28c840" };

type OpaqueToken = { glass?: false; accent: string; bg: string; headerBg: string; buttonBg: string; promptAccent?: string };
type GlassToken  = { glass: true;  accent: string; bg: string };
type ThemeToken  = OpaqueToken | GlassToken;

const THEME_TOKENS: Record<string, ThemeToken> = {
  matrix: { accent: "#00ff41", bg: "#000",    headerBg: "#000",    buttonBg: "#003300" },
  retro:  { accent: "#e8920a", bg: "#0d0500", headerBg: "#1a0900", buttonBg: "#7a3a00", promptAccent: "#b85c00" },
  mint:   { glass: true, accent: "#00ffcc", bg: "rgba(0,0,0,0.35)" },
  pink:   { glass: true, accent: "#ff66b2", bg: "rgba(0,0,0,0.6)"  },
};

function buildTheme(token: ThemeToken): ThemeStyles {
  const { accent, bg } = token;
  if (token.glass) {
    return {
      accentColor: accent,
      container: { background: bg, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: `1px solid ${accent}`, borderRadius: 8, boxShadow: `0 0 20px ${accent}33` },
      header:    { background: "transparent", borderBottom: `1px solid ${accent}66` },
      output:    { color: accent },
      button:    { background: `${accent}1a`, border: `1px solid ${accent}`, color: accent, cursor: "pointer" },
      prompt:    { color: accent },
    };
  }
  const { headerBg, buttonBg, promptAccent = accent } = token;
  return {
    accentColor: accent,
    container: { background: bg, border: `1px solid ${promptAccent}`, borderRadius: 8, boxShadow: `0 0 24px ${accent}33` },
    header:    { background: headerBg, borderBottom: `1px solid ${promptAccent}` },
    output:    { color: accent },
    button:    { background: buttonBg, border: `1px solid ${promptAccent}`, color: accent, cursor: "pointer" },
    prompt:    { color: promptAccent },
  };
}

const THEMES = Object.fromEntries(
  Object.entries(THEME_TOKENS).map(([k, t]) => [k, buildTheme(t)])
);

type Phase = "idle" | "running" | "done";

interface InteractiveTerminalProps {
  steps?: string[];
  finalMessage?: string;
  stepDelay?: number;
  icon?: React.ReactNode;
  promptSymbol?: string;
  inputPlaceholder?: string;
  repeat?: boolean;
  repeatDelay?: number;
  variant?: string;
  style?: CSSProperties;
}

export function InteractiveTerminal({
  steps = ["Processing command"],
  finalMessage = "Command executed successfully!",
  stepDelay = 1000,
  icon = <CakeSlice size={16} />, 
  promptSymbol = "$",
  inputPlaceholder = "Type your command here",
  repeat = false,
  repeatDelay = 3000,
  variant = "mint",
  style = {},
}: InteractiveTerminalProps) {
  const theme = THEMES[variant] ?? THEMES.pink;

  const [inputValue, setInputValue] = useState("");
  const [executedCommand, setExecutedCommand] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [visibleSteps, setVisibleSteps] = useState<string[]>([]);
  const [showFinal, setShowFinal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const timerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    return () => { timerIdsRef.current.forEach(clearTimeout); };
  }, []);

  // setTimeout wrapper that registers the ID for cleanup
  const trackedDelay = (ms: number) =>
    new Promise<void>((r) => {
      const id = setTimeout(r, ms);
      timerIdsRef.current.push(id);
    });

  const reset = () => {
    setInputValue("");
    setExecutedCommand("");
    setPhase("idle");
    setVisibleSteps([]);
    setShowFinal(false);
  };

  const runSequence = async () => {
    setPhase("running");
    setVisibleSteps([]);
    setShowFinal(false);
    for (let i = 0; i < steps.length; i++) {
      await trackedDelay(stepDelay);
      setVisibleSteps((prev) => [...prev, steps[i]]);
      if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
    await trackedDelay(stepDelay);
    setShowFinal(true);
    setPhase("done");
    if (repeat) {
      const id = setTimeout(() => { reset(); }, repeatDelay);
      timerIdsRef.current.push(id);
    }
  };

  const handleRun = () => {
    if (phase === "running") return;
    if (inputValue.trim() === "") { 
      inputRef.current?.focus(); 
      return; 
    }
    setExecutedCommand(inputValue);
    runSequence();
  };

  const out = theme.output;

  return (
    <div
      style={{
        ...theme.container,
        fontFamily: "monospace",
        fontSize: 14,
        overflow: "hidden",
        width: "100%",
        maxWidth: 640,
        ...style,
      }}
    >
      <div style={{ ...theme.header, display: "flex", alignItems: "center", gap: 6, padding: "10px 16px" }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: DOTS.r, display: "inline-block" }} />
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: DOTS.y, display: "inline-block" }} />
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: DOTS.g, display: "inline-block" }} />
      </div>

      <div style={{ ...theme.header, display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderTop: "none" }}>
        {icon && <span style={{ ...out, marginRight: 4, display: "flex", alignItems: "center" }}>{icon}</span>}
        <span style={{ ...out, opacity: 0.6, fontSize: 12 }}>Run:</span>
        <code style={{ ...out, fontWeight: "bold", fontSize: 13 }}>
          {executedCommand || "muffin.cakes.dev"}
        </code>
        {phase === "done" && (
          <button
            onClick={reset}
            style={{
              ...theme.button,
              marginLeft: "auto",
              padding: "2px 12px",
              borderRadius: 4,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Reset
          </button>
        )}
      </div>

      <div
        ref={outputRef}
        style={{
          padding: "12px 16px",
          minHeight: 140,
          maxHeight: 260,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          background: "transparent",
        }}
      >
        {visibleSteps.map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 8, ...out }}>
            <span style={{ opacity: 0.5 }}>›</span>
            <span>{step}</span>
          </div>
        ))}
        {showFinal && (
          <div style={{ ...out, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {finalMessage.split("\n").map((line, i) => (
              <div key={i} style={{ fontWeight: i === 0 ? "bold" : "normal" }}>
                {line}
              </div>
            ))}
          </div>
        )}
        {phase === "idle" && visibleSteps.length === 0 && (
          <div style={{ ...out, opacity: 0.3, fontSize: 12 }}>Awaiting command...</div>
        )}
      </div>
      <div
        style={{
          ...theme.header,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderTop: "none",
          borderTopWidth: 1,
          borderTopStyle: "solid",
          borderTopColor: `${theme.accentColor}66`,
        }}
      >
        <span style={{ ...theme.prompt, fontWeight: "bold", userSelect: "none" }}>{promptSymbol}</span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRun()}
          placeholder={inputPlaceholder}
          disabled={phase === "running"}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            boxShadow: inputFocused ? `0 1px 0 0 ${theme.accentColor}` : "none",
            ...out,
            fontSize: 14,
            opacity: phase === "running" ? 0.5 : 1,
          }}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          autoComplete="off"
          spellCheck={false}
        />
        {phase !== "done" && (
          <button
            onClick={handleRun}
            disabled={phase === "running" || inputValue.trim() === ""}
            style={{
              ...theme.button,
              padding: "3px 14px",
              borderRadius: 4,
              fontSize: 12,
              opacity: phase === "running" || inputValue.trim() === "" ? 0.4 : 1,
            }}
          >
            {phase === "running" ? "Running..." : "Run"}
          </button>
        )}
      </div>
    </div>
  );
}