// Parses raw Wings/Minecraft console lines into styled, link-aware tokens for
// rendering in ConsoleTab. Handles two independent, unrelated code schemes
// confirmed to both appear in the live stream (see the 2026-08-21 "Console
// ANSI/color ground truth captured" DEVLOG entry — real hex-dumped samples
// from a disposable Paper server, not assumed from docs):
//   - ANSI SGR escapes (`\x1b[...m`) — 16-color only (confirmed no 256-color
//     or truecolor ever appears). Despite the Paper egg's startup command
//     passing `-Dterminal.ansi=true`, ordinary `[HH:MM:SS INFO]:` boilerplate
//     carries ZERO ansi codes — it only shows up on Wings' own container
//     banner, `/help` output, and Brigadier's "unknown command" error. That
//     last one also proved two things this parser must handle: multiple SGR
//     attributes can stack (color+underline, then reset+italic+color), and
//     not every console-output event has a `[time LEVEL]:` prefix at all —
//     some are raw continuation fragments (e.g. the `<--[HERE]` pointer
//     line), which is why the prefix-detection below requires the *first*
//     visible character of the line to be `[`, not just the presence of a
//     `]` anywhere in it.
//   - Legacy `§`-prefixed Minecraft color codes — come through completely
//     RAW/unconverted on the live stream (not translated to ANSI at all).
// The on-disk log file (`GET /:identifier/console/history`) is a genuinely
// different format — no thread name live vs. a thread name in the file, and
// confirmed ZERO ansi codes anywhere in the file (Log4j2's file appender uses
// a plain, non-ANSI layout) — but `§` codes persist there too. This module
// doesn't need a separate code path for that: with no ANSI present, parsing
// just degrades to `§`-only + plain text, which is all the file ever needs.
// Same graceful degradation covers the mock/non-live console data, which is
// plain text with neither scheme.
//
// This module is pure/framework-agnostic on purpose — no React/DOM — so it
// can be (and was) exercised directly from a plain Node script against real
// captured sample lines before wiring it into ConsoleTab.
//
// Color values are NOT raw terminal-ANSI hexes — they're picked to harmonize
// with this project's dark violet theme (see `src/index.css`'s `@theme`
// block) while staying recognizably tied to each named Minecraft color.

export interface ConsoleToken {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  href?: string;
}

export interface FormattedConsoleLine {
  prefix: ConsoleToken[];
  body: ConsoleToken[];
}

// Legacy Minecraft color codes (`§0`-`§f`) -> theme-harmonized hex. This is a
// fixed, publicly documented spec (see the Minecraft Wiki's "Formatting
// codes" page) — stable regardless of how this project's own infra emits
// color. Also doubles as the target palette for the ANSI 16-color codes
// below, since both schemes name the same 16 colors.
const LEGACY_COLOR_HEX: Record<string, string> = {
  "0": "#3a3a44", // black -> lightened off the theme's true-black so it's still legible on --color-ink
  "1": "#5a7ee0", // dark_blue
  "2": "#4fb85f", // dark_green
  "3": "#3fb6c9", // dark_aqua
  "4": "#d1555a", // dark_red
  "5": "#b47eea", // dark_purple
  "6": "#e0a94a", // gold
  "7": "#b6b5c2", // gray (== --color-text-md)
  "8": "#8f8e9b", // dark_gray (== --color-text-lo)
  a: "#6fe07f", // green
  b: "#5fd6ea", // aqua
  c: "#f2777c", // red (close to --color-bad, not identical)
  d: "#d9a0f5", // light_purple
  e: "#f5d76e", // yellow
  f: "#f2f1f6", // white (== --color-text-hi)
  "9": "#7c9dff", // blue
};

// ANSI SGR 16-color codes -> the same named palette. Confirmed against real
// captured output: standard range (30-37) and bright range (90-97) only,
// e.g. `/help` uses 33 (gold) + 97 (white), the "unknown command" error uses
// 91 (red) and 37 (gray). No 256-color/truecolor handling needed — confirmed
// never emitted by this stack.
const ANSI_BASIC_HEX: Record<number, string> = {
  30: LEGACY_COLOR_HEX["0"],
  31: LEGACY_COLOR_HEX["4"],
  32: LEGACY_COLOR_HEX["2"],
  33: LEGACY_COLOR_HEX["6"],
  34: LEGACY_COLOR_HEX["1"],
  35: LEGACY_COLOR_HEX["5"],
  36: LEGACY_COLOR_HEX["3"],
  37: LEGACY_COLOR_HEX["7"],
  90: LEGACY_COLOR_HEX["8"],
  91: LEGACY_COLOR_HEX["c"],
  92: LEGACY_COLOR_HEX["a"],
  93: LEGACY_COLOR_HEX["e"],
  94: LEGACY_COLOR_HEX["9"],
  95: LEGACY_COLOR_HEX["d"],
  96: LEGACY_COLOR_HEX["b"],
  97: LEGACY_COLOR_HEX["f"],
};

interface StyleState {
  color: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

function applyLegacyCode(code: string, state: StyleState): void {
  const lower = code.toLowerCase();
  if (lower === "r") {
    state.color = null;
    state.bold = false;
    state.italic = false;
    state.underline = false;
    return;
  }
  if (lower === "l") {
    state.bold = true;
    return;
  }
  if (lower === "o") {
    state.italic = true;
    return;
  }
  if (lower === "n") {
    state.underline = true;
    return;
  }
  if (lower in LEGACY_COLOR_HEX) {
    // Minecraft resets bold/italic/underline whenever a new color code is applied.
    state.color = LEGACY_COLOR_HEX[lower];
    state.bold = false;
    state.italic = false;
    state.underline = false;
  }
  // k/m (obfuscated/strikethrough): consumed so they don't leak into visible
  // text, but not styled — no confirmed real usage and no rendering support
  // for either yet.
}

function applySgrParams(params: string, state: StyleState): void {
  const codes = params
    .split(";")
    .filter((c) => c !== "")
    .map(Number);
  if (codes.length === 0) codes.push(0); // bare `\x1b[m` means reset

  for (const code of codes) {
    if (code === 0) {
      state.color = null;
      state.bold = false;
      state.italic = false;
      state.underline = false;
    } else if (code === 1) {
      state.bold = true;
    } else if (code === 22) {
      state.bold = false;
    } else if (code === 3) {
      state.italic = true;
    } else if (code === 23) {
      state.italic = false;
    } else if (code === 4) {
      state.underline = true;
    } else if (code === 24) {
      state.underline = false;
    } else if (code === 39) {
      state.color = null;
    } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
      state.color = ANSI_BASIC_HEX[code] ?? state.color;
    }
    // Everything else (background colors 40-49/100-107, strikethrough=9,
    // etc.) is intentionally ignored — no confirmed real usage.
  }
}

const CODE_RE = /\x1b\[([0-9;]*)m|§([0-9a-fk-or])/gi;

function pushSegment(segments: ConsoleToken[], text: string, state: StyleState): void {
  if (!text) return;
  const token: ConsoleToken = { text };
  if (state.color) token.color = state.color;
  if (state.bold) token.bold = true;
  if (state.italic) token.italic = true;
  if (state.underline) token.underline = true;
  segments.push(token);
}

function parseStyledSegments(raw: string): ConsoleToken[] {
  const segments: ConsoleToken[] = [];
  const state: StyleState = { color: null, bold: false, italic: false, underline: false };
  let lastIndex = 0;
  CODE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CODE_RE.exec(raw))) {
    if (match.index > lastIndex) {
      pushSegment(segments, raw.slice(lastIndex, match.index), state);
    }
    if (match[1] !== undefined) {
      applySgrParams(match[1], state);
    } else if (match[2] !== undefined) {
      applyLegacyCode(match[2], state);
    }
    lastIndex = CODE_RE.lastIndex;
  }
  if (lastIndex < raw.length) {
    pushSegment(segments, raw.slice(lastIndex), state);
  }
  return segments;
}

// Permissive on purpose (not a full RFC 3986 parser) — trims common trailing
// punctuation that's almost certainly not part of the URL (e.g. a sentence
// ending in a link followed by a period).
const URL_RE = /https?:\/\/\S+/g;
const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]'"]$/;

function linkify(segments: ConsoleToken[]): ConsoleToken[] {
  const out: ConsoleToken[] = [];
  for (const seg of segments) {
    URL_RE.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let found = false;
    while ((match = URL_RE.exec(seg.text))) {
      found = true;
      if (match.index > lastIndex) {
        out.push({ ...seg, text: seg.text.slice(lastIndex, match.index) });
      }
      let url = match[0];
      let trailing = "";
      while (url.length > 0 && TRAILING_PUNCTUATION_RE.test(url)) {
        trailing = url[url.length - 1] + trailing;
        url = url.slice(0, -1);
      }
      out.push({ ...seg, text: url, href: url });
      if (trailing) out.push({ ...seg, text: trailing });
      lastIndex = match.index + match[0].length;
    }
    if (!found) {
      out.push(seg);
    } else if (lastIndex < seg.text.length) {
      out.push({ ...seg, text: seg.text.slice(lastIndex) });
    }
  }
  return out;
}

// Splits off the leading `[...]` timestamp bracket (if any) so ConsoleTab can
// keep dimming it the same way it always has. Requires the line's true FIRST
// visible character to be `[` before treating anything as a timestamp prefix
// — confirmed necessary by a real captured line (Brigadier's `<--[HERE]`
// command-error pointer) that contains a `]` in its body with no timestamp
// bracket at all; a naive "first `]` anywhere" scan would wrongly swallow
// that entire styled line into a plain dimmed "prefix". The prefix itself
// still always renders plain/dim regardless of any style embedded in it —
// every real timestamp bracket captured so far (`[HH:MM:SS LEVEL]:`) is
// plain, uncolored text.
function splitAtFirstBracket(tokens: ConsoleToken[]): FormattedConsoleLine {
  if (tokens.length === 0 || !tokens[0].text.startsWith("[")) {
    return { prefix: [], body: tokens };
  }

  const prefix: ConsoleToken[] = [];
  const body: ConsoleToken[] = [];
  let splitDone = false;

  for (const token of tokens) {
    if (splitDone) {
      body.push(token);
      continue;
    }
    const idx = token.text.indexOf("]");
    if (idx === -1) {
      prefix.push({ text: token.text });
      continue;
    }
    const before = token.text.slice(0, idx + 1);
    const after = token.text.slice(idx + 1);
    if (before) prefix.push({ text: before });
    if (after) body.push({ ...token, text: after });
    splitDone = true;
  }

  if (!splitDone) {
    // Started with "[" but no "]" ever closed it (truncated/odd line) —
    // treat the whole thing as body rather than guessing.
    return { prefix: [], body: tokens };
  }
  return { prefix, body };
}

export function formatConsoleLine(raw: string): FormattedConsoleLine {
  const styled = parseStyledSegments(raw);
  const linked = linkify(styled);
  return splitAtFirstBracket(linked);
}
