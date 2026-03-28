import type { LudoAction, LudoColor, LudoPlayer, LudoState, LudoToken, TokenPos } from "./types";
import { ENTRY_INDEX } from "./boardLayout";

const COLORS: LudoColor[] = ["red", "green", "yellow", "blue"];

// Global track length
const TRACK_LEN = 52;
// ممر البيت: 5 مربعات ملونة ثم المربع الأوسط (خطوات home: 0..4 ثم finished)
const HOME_LEN = 6;

// Safe squares (no capture) - common set; keep minimal
const SAFE: Set<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

function clampInt(n: number, min: number, max: number): number {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function tokenId(color: LudoColor, i: number): string {
  return `${color}-${i}`;
}

export function createInitialState(params: {
  sessionId: string;
  hostId: string;
  players: { id: string; name: string }[];
  seedTurnPlayerId?: string;
}): LudoState {
  const pickedPlayers: LudoPlayer[] = params.players.slice(0, 4).map((p, idx) => ({
    id: String(p.id),
    name: String(p.name || "مستخدم"),
    color: COLORS[idx],
    connected: true,
  }));
  const tokens: LudoToken[] = [];
  for (const pl of pickedPlayers) {
    for (let i = 0; i < 4; i++) {
      tokens.push({ id: tokenId(pl.color, i), color: pl.color, pos: { kind: "yard" } });
    }
  }
  const turn = params.seedTurnPlayerId && pickedPlayers.some((p) => p.id === params.seedTurnPlayerId)
    ? params.seedTurnPlayerId
    : pickedPlayers[0]?.id || params.hostId;
  return {
    sessionId: params.sessionId,
    version: 1,
    hostId: params.hostId,
    players: pickedPlayers,
    tokens,
    turnPlayerId: turn,
    sixStreak: 0,
    lastRoll: null,
    lastRollBy: null,
    canRoll: true,
    movableTokenIds: [],
    winners: [],
    updatedAt: Date.now(),
  };
}

function getPlayer(state: LudoState, playerId: string): LudoPlayer | null {
  return state.players.find((p) => p.id === playerId) || null;
}

function getPlayerByColor(state: LudoState, color: LudoColor): LudoPlayer | null {
  return state.players.find((p) => p.color === color) || null;
}

function nextPlayerId(state: LudoState, fromId: string): string {
  const alive = state.players.filter((p) => !state.winners.includes(p.id));
  if (alive.length === 0) return fromId;
  const idx = alive.findIndex((p) => p.id === fromId);
  return alive[(idx + 1 + alive.length) % alive.length].id;
}

function tokensOfPlayer(state: LudoState, playerId: string): LudoToken[] {
  const pl = getPlayer(state, playerId);
  if (!pl) return [];
  return state.tokens.filter((t) => t.color === pl.color);
}

function samePos(a: TokenPos, b: TokenPos): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "yard" || a.kind === "finished") return true;
  if (a.kind === "track" && b.kind === "track") return a.index === b.index;
  if (a.kind === "home" && b.kind === "home") return a.step === b.step;
  return false;
}

function isCaptureAllowed(targetIndex: number): boolean {
  return !SAFE.has(targetIndex);
}

function applyCapture(state: LudoState, moverColor: LudoColor, targetIndex: number): LudoState {
  if (!isCaptureAllowed(targetIndex)) return state;
  const next: LudoState = { ...state, tokens: state.tokens.map((t) => ({ ...t, pos: { ...t.pos } as any })) };
  for (const t of next.tokens) {
    if (t.color === moverColor) continue;
    if (t.pos.kind === "track" && t.pos.index === targetIndex) {
      t.pos = { kind: "yard" };
    }
  }
  return next;
}

function globalIndexForColorProgress(color: LudoColor, progress: number): number {
  // progress 0 means entry index itself
  return (ENTRY_INDEX[color] + progress) % TRACK_LEN;
}

function progressFromGlobal(color: LudoColor, globalIndex: number): number {
  const entry = ENTRY_INDEX[color];
  const diff = (globalIndex - entry + TRACK_LEN) % TRACK_LEN;
  return diff;
}

function canEnterFromYard(roll: number): boolean {
  return roll === 6;
}

/** خطوة واحدة للأمام (للرسوم: مربع مربع) */
function stepOnceForward(color: LudoColor, pos: TokenPos): TokenPos | null {
  if (pos.kind === "finished") return null;
  if (pos.kind === "yard") {
    return { kind: "track", index: ENTRY_INDEX[color] };
  }
  if (pos.kind === "home") {
    const ns = pos.step + 1;
    if (ns > HOME_LEN - 1) return null;
    if (ns === HOME_LEN - 1) return { kind: "finished" };
    return { kind: "home", step: ns };
  }
  const progress = progressFromGlobal(color, pos.index);
  const np = progress + 1;
  if (np < TRACK_LEN) {
    return { kind: "track", index: globalIndexForColorProgress(color, np) };
  }
  const homeStep = np - TRACK_LEN;
  if (homeStep > HOME_LEN - 1) return null;
  if (homeStep === HOME_LEN - 1) return { kind: "finished" };
  return { kind: "home", step: homeStep };
}

/**
 * كل موضع بعد كل نقطة من النرد (مثلاً 3 → 3 مواضع نهائية بعد كل خطوة).
 * من البيت مع 6: قفزة واحدة إلى مربع الدخول.
 */
export function computeMoveWaypoints(color: LudoColor, from: TokenPos, roll: number): TokenPos[] {
  if (from.kind === "yard") {
    if (roll !== 6) return [];
    return [{ kind: "track", index: ENTRY_INDEX[color] }];
  }
  const out: TokenPos[] = [];
  let cur = from;
  for (let i = 0; i < roll; i++) {
    const n = stepOnceForward(color, cur);
    if (!n) break;
    out.push(n);
    cur = n;
  }
  return out;
}

function computeMove(state: LudoState, playerId: string, token: LudoToken, roll: number): TokenPos | null {
  const pl = getPlayer(state, playerId);
  if (!pl) return null;
  const color = pl.color;
  if (token.color !== color) return null;
  if (token.pos.kind === "finished") return null;

  if (token.pos.kind === "yard") {
    if (!canEnterFromYard(roll)) return null;
    return { kind: "track", index: ENTRY_INDEX[color] };
  }

  if (token.pos.kind === "home") {
    const nextStep = token.pos.step + roll;
    if (nextStep > HOME_LEN - 1) return null;
    if (nextStep === HOME_LEN - 1) return { kind: "finished" };
    return { kind: "home", step: nextStep };
  }

  // on track
  const currentProgress = progressFromGlobal(color, token.pos.index);
  const nextProgress = currentProgress + roll;
  // progress 0..51 are track, progress 52..57 are home stretch (6)
  if (nextProgress < TRACK_LEN) {
    return { kind: "track", index: globalIndexForColorProgress(color, nextProgress) };
  }
  const homeStep = nextProgress - TRACK_LEN; // 0..?
  if (homeStep > HOME_LEN - 1) return null;
  if (homeStep === HOME_LEN - 1) return { kind: "finished" };
  return { kind: "home", step: homeStep };
}

function computeMovableTokens(state: LudoState, playerId: string, roll: number): string[] {
  const toks = tokensOfPlayer(state, playerId);
  const ids: string[] = [];
  for (const t of toks) {
    const next = computeMove(state, playerId, t, roll);
    if (!next) continue;
    // Allow stacking on your own token on the shared track (common Ludo rule),
    // but still prevent landing on your own token in home stretch.
    const occupiedBySelf = toks.some((o) => o.id !== t.id && samePos(o.pos, next));
    // على المسار وفي الوسط: يُسمح بتكدس أكثر من قطعة لنفس اللاعب
    if (occupiedBySelf && next.kind !== "track" && next.kind !== "finished") continue;
    ids.push(t.id);
  }
  return ids;
}

function applyMove(state: LudoState, playerId: string, tokenIdToMove: string, roll: number): LudoState | null {
  const pl = getPlayer(state, playerId);
  if (!pl) return null;
  const toks = tokensOfPlayer(state, playerId);
  const t = state.tokens.find((x) => x.id === tokenIdToMove);
  if (!t) return null;
  const nextPos = computeMove(state, playerId, t, roll);
  if (!nextPos) return null;
  if (!computeMovableTokens(state, playerId, roll).includes(tokenIdToMove)) return null;

  let next: LudoState = {
    ...state,
    tokens: state.tokens.map((x) => (x.id === tokenIdToMove ? { ...x, pos: nextPos } : { ...x })),
  };
  if (nextPos.kind === "track") {
    next = applyCapture(next, pl.color, nextPos.index);
  }

  // check win
  const myTokens = next.tokens.filter((x) => x.color === pl.color);
  const allFinished = myTokens.every((x) => x.pos.kind === "finished");
  if (allFinished && !next.winners.includes(pl.id)) {
    next = { ...next, winners: [...next.winners, pl.id] };
  }

  const extraTurn = roll === 6;
  const nextTurn = extraTurn ? pl.id : nextPlayerId(next, pl.id);
  return {
    ...next,
    version: next.version + 1,
    turnPlayerId: nextTurn,
    sixStreak: extraTurn ? state.sixStreak : 0,
    lastRoll: null,
    lastRollBy: null,
    canRoll: true,
    movableTokenIds: [],
    updatedAt: Date.now(),
  };
}

function applyRoll(state: LudoState, fromId: string, roll: number): LudoState | null {
  if (state.turnPlayerId !== fromId) return null;
  if (!state.canRoll) return null;
  const r = clampInt(roll, 1, 6);
  const nextStreak = r === 6 ? (state.sixStreak ?? 0) + 1 : 0;
  // 3 مرات 6 وراء بعض -> ينتهي الدور مباشرة وتنتقل للاعب التالي
  if (r === 6 && nextStreak >= 3) {
    const nextTurn = nextPlayerId(state, state.turnPlayerId);
    return {
      ...state,
      version: state.version + 1,
      turnPlayerId: nextTurn,
      sixStreak: 0,
      lastRoll: null,
      lastRollBy: null,
      canRoll: true,
      movableTokenIds: [],
      updatedAt: Date.now(),
    };
  }
  const movable = computeMovableTokens(state, fromId, r);
  return {
    ...state,
    version: state.version + 1,
    sixStreak: nextStreak,
    lastRoll: r,
    lastRollBy: fromId,
    canRoll: movable.length === 0 ? true : false, // if no moves, allow roll again but we will advance turn below
    movableTokenIds: movable,
    updatedAt: Date.now(),
  };
}

function advanceIfNoMoves(state: LudoState): LudoState {
  if (state.lastRoll == null) return state;
  if (state.movableTokenIds.length > 0) return state;
  // no move possible -> pass turn (unless roll was 6; still no moves, pass)
  const nextTurn = nextPlayerId(state, state.turnPlayerId);
  return {
    ...state,
    version: state.version + 1,
    turnPlayerId: nextTurn,
    sixStreak: 0,
    lastRoll: null,
    lastRollBy: null,
    canRoll: true,
    movableTokenIds: [],
    updatedAt: Date.now(),
  };
}

export function reduceHost(state: LudoState, action: LudoAction, rng?: () => number): LudoState {
  const rand = rng || (() => Math.random());
  const ensure = (s: LudoState) => ({ ...s, updatedAt: Date.now() });

  if (action.type === "ludo_join") {
    const exists = state.players.some((p) => p.id === action.player.id);
    if (exists) {
      return ensure({
        ...state,
        players: state.players.map((p) => (p.id === action.player.id ? { ...p, connected: true, name: action.player.name || p.name } : p)),
        version: state.version + 1,
      });
    }
    if (state.players.length >= 4) return state;
    const usedColors = new Set(state.players.map((p) => p.color));
    const color = COLORS.find((c) => !usedColors.has(c)) || COLORS[state.players.length % COLORS.length];
    const newPlayer: LudoPlayer = { id: action.player.id, name: action.player.name || "مستخدم", color, connected: true };
    const newTokens: LudoToken[] = [];
    for (let i = 0; i < 4; i++) newTokens.push({ id: tokenId(color, i), color, pos: { kind: "yard" } });
    return ensure({
      ...state,
      version: state.version + 1,
      players: [...state.players, newPlayer],
      tokens: [...state.tokens, ...newTokens],
    });
  }

  if (action.type === "ludo_leave") {
    return ensure({
      ...state,
      version: state.version + 1,
      players: state.players.map((p) => (p.id === action.playerId ? { ...p, connected: false } : p)),
    });
  }

  if (action.type === "ludo_roll") {
    const roll = 1 + Math.floor(rand() * 6);
    const rolled = applyRoll(state, action.fromId, roll);
    if (!rolled) return state;
    return advanceIfNoMoves(ensure(rolled));
  }

  if (action.type === "ludo_move") {
    if (state.lastRoll == null) return state;
    if (state.turnPlayerId !== action.fromId) return state;
    const moved = applyMove(state, action.fromId, action.tokenId, state.lastRoll);
    if (!moved) return state;
    return ensure(moved);
  }

  if (action.type === "ludo_start") {
    // re-init state with selected players
    return createInitialState({ sessionId: action.sessionId, hostId: state.hostId, players: action.players, seedTurnPlayerId: action.fromId });
  }

  return state;
}

export function isValidPlayerCount(n: number): boolean {
  return n >= 2 && n <= 4;
}

export function getPlayerColor(state: LudoState, playerId: string): LudoColor | null {
  return getPlayer(state, playerId)?.color ?? null;
}

export function getTokensForColor(state: LudoState, color: LudoColor): LudoToken[] {
  return state.tokens.filter((t) => t.color === color);
}

