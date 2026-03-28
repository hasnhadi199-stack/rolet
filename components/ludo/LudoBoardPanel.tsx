import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View, Text, TouchableOpacity, StyleSheet, Dimensions, Image, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { LudoColor, LudoState, TokenPos } from "../../utils/ludo/types";
import { computeMoveWaypoints, createInitialState, reduceHost } from "../../utils/ludo/ludoEngine";
import {
  cellToXY,
  COLOR_HEX,
  ENTRY_INDEX,
  entryArrowStyleForTrackIndex,
  finishAnchorXY,
  HOME_CELLS,
  homeStepXY,
  TRACK_CELLS,
  trackIndexToXY,
  yardSlotXY,
} from "../../utils/ludo/boardLayout";

/** مربعات آمنة — مطابقة للمحرك */
const SAFE_STARS = [0, 8, 13, 21, 26, 34, 39, 47];
const SAFE_STAR_BG = "#9ca3af"; // خلفية رصاصي (ثابتة بدون شفافية)
const SAFE_STAR_FG = "#ffffff"; // نجمة أبيض

const TXT = "#1e1b2e";
const TXT_MUTED = "#64748b";
const ACCENT_BLUE = "#2563eb";

const { width: SW } = Dimensions.get("window");
const BOARD = Math.min(SW - 36, 320);
// شبكة 15×15 تملأ اللوحة (بدون فراغات على الحواف)
const CELL_PCT = 100 / 15;

type PlayerLite = { id: string; name: string; profileImage?: string | null };

type Props = {
  sessionId: string;
  me: PlayerLite;
  players: PlayerLite[];
  onBackToLobby: () => void;
};

function tokenRenderPos(color: LudoColor, id: string, pos: TokenPos): { x: number; y: number } {
  const slot = parseInt(id.split("-")[1] || "0", 10) % 4;
  if (pos.kind === "yard") return yardSlotXY(color, slot);
  if (pos.kind === "track") return trackIndexToXY(pos.index);
  if (pos.kind === "home") return homeStepXY(color, pos.step);
  return finishAnchorXY(color);
}

/** مطابقة موضع pawnWrap: مركز القطعة عند (x%,y%) من اللوحة */
function boardPixelForToken(color: LudoColor, id: string, pos: TokenPos, boardSize: number, stackDx = 0, stackDy = 0) {
  const { x, y } = tokenRenderPos(color, id, pos);
  return {
    left: (x / 100) * boardSize - 12 + stackDx,
    top: (y / 100) * boardSize - 12 + stackDy,
  };
}

const PAWN_SZ = 24;
const BOARD_EDGE_PAD = 1.5;

/** لا تخرج القطعة (24×24) خارج حدود اللوحة أثناء الحركة */
function clampPawnPixel(left: number, top: number, boardSize: number) {
  const maxL = boardSize - PAWN_SZ - BOARD_EDGE_PAD;
  const maxT = boardSize - PAWN_SZ - BOARD_EDGE_PAD;
  return {
    left: Math.min(Math.max(BOARD_EDGE_PAD, left), maxL),
    top: Math.min(Math.max(BOARD_EDGE_PAD, top), maxT),
  };
}

type GridCell = readonly [number, number];

function cellsForGridStep(pos: TokenPos, color: LudoColor): GridCell | null {
  if (pos.kind === "track") {
    const i = ((pos.index % 52) + 52) % 52;
    const c = TRACK_CELLS[i];
    return c ? ([c[0], c[1]] as const) : null;
  }
  if (pos.kind === "home") {
    const h = HOME_CELLS[color]?.[pos.step];
    return h ? ([h[0], h[1]] as const) : null;
  }
  return null;
}

function pixelFromGridCell(cell: GridCell, boardSize: number) {
  const { x, y } = cellToXY(cell);
  return clampPawnPixel((x / 100) * boardSize - 12, (y / 100) * boardSize - 12, boardSize);
}

/**
 * نقاط انزلاق داخل مربعات الشبكة: صف/عمود فقط عبر مركز مربع وسيط عند الزوايا (مثل مسار TRACK).
 */
function waypointsForMove(
  fromPos: TokenPos,
  toPos: TokenPos,
  color: LudoColor,
  tokenId: string,
  boardSize: number
): { left: number; top: number }[] {
  const toPx = clampPawnPixel(
    boardPixelForToken(color, tokenId, toPos, boardSize).left,
    boardPixelForToken(color, tokenId, toPos, boardSize).top,
    boardSize
  );
  const ca = cellsForGridStep(fromPos, color);
  const cb = cellsForGridStep(toPos, color);
  if (!ca || !cb) {
    const fromPx = clampPawnPixel(
      boardPixelForToken(color, tokenId, fromPos, boardSize).left,
      boardPixelForToken(color, tokenId, fromPos, boardSize).top,
      boardSize
    );
    const dx = toPx.left - fromPx.left;
    const dy = toPx.top - fromPx.top;
    const eps = 2;
    if (Math.abs(dx) <= eps || Math.abs(dy) <= eps) return [toPx];
    const corner =
      Math.abs(dx) >= Math.abs(dy)
        ? { left: toPx.left, top: fromPx.top }
        : { left: fromPx.left, top: toPx.top };
    return [clampPawnPixel(corner.left, corner.top, boardSize), toPx];
  }
  const dr = cb[0] - ca[0];
  const dc = cb[1] - ca[1];
  if (dr === 0 || dc === 0) return [toPx];
  const mid: GridCell = Math.abs(dc) >= Math.abs(dr) ? [ca[0], cb[1]] : [cb[0], ca[1]];
  return [pixelFromGridCell(mid, boardSize), toPx];
}

/**
 * القطع المنتهية: 2×2 ضيّق حتى لا تخرج عن ربع الماسة الملون.
 * ترتيب حسب id: 0 أعلى-يسار، 1 أعلى-يمين، 2 أسفل-يسار، 3 أسفل-يمين.
 */
function finishClusterOffset(order: number, count: number): { dx: number; dy: number } {
  const u = Math.max(3, Math.round(BOARD * 0.0085));
  if (count <= 1) return { dx: 0, dy: 0 };
  if (count === 2) {
    return order === 0 ? { dx: -u, dy: 0 } : { dx: u, dy: 0 };
  }
  if (count === 3) {
    const tri = [
      { dx: -u * 0.82, dy: -u * 0.5 },
      { dx: u * 0.82, dy: -u * 0.5 },
      { dx: 0, dy: u * 0.88 },
    ];
    return tri[order] ?? { dx: 0, dy: 0 };
  }
  const quad = [
    { dx: -u, dy: -u },
    { dx: u, dy: -u },
    { dx: -u, dy: u },
    { dx: u, dy: u },
  ];
  return quad[order] ?? { dx: 0, dy: 0 };
}

function finishClusterScale(count: number): number {
  if (count <= 1) return 0.84;
  if (count === 2) return 0.76;
  if (count === 3) return 0.7;
  return 0.62;
}

const CORNER_POS: Record<LudoColor, ViewStyle> = {
  red: { left: "0%", top: "0%" },
  green: { right: "0%", top: "0%" },
  yellow: { right: "0%", bottom: "0%" },
  blue: { left: "0%", bottom: "0%" },
};

function posKey(pos: TokenPos): string {
  if (pos.kind === "yard") return "yard";
  if (pos.kind === "finished") return "finished";
  if (pos.kind === "track") return `t-${pos.index}`;
  return `h-${pos.step}`;
}

function samePos(a: TokenPos, b: TokenPos): boolean {
  if (a.kind !== b.kind) return false;
  // yard positions are per-token slot (handled separately), so don't treat all yard tokens as one cell
  if (a.kind === "yard") return false;
  // finished: كل القطع داخل مربع الوسط
  if (a.kind === "finished") return true;
  if (a.kind === "track" && b.kind === "track") return a.index === b.index;
  if (a.kind === "home" && b.kind === "home") return a.step === b.step;
  return false;
}

function stackOffset(i: number, count: number): { dx: number; dy: number } {
  if (count <= 1) return { dx: 0, dy: 0 };
  // 2x2 داخل نفس المربع (شكل مرتب مثل لودو الحقيقي)
  const k = i % 4;
  const s = count >= 3 ? 6 : 7;
  const dx = k === 0 || k === 2 ? -s : s;
  const dy = k === 0 || k === 1 ? -s : s;
  return { dx, dy };
}

function stackScale(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 0.9;
  if (count === 3) return 0.82;
  return 0.78;
}

type MoveAnim = { tokenId: string; color: LudoColor; keyframes: TokenPos[] };

/** لعب تلقائي: رمي أو تحريك (مع أنيميشن خطوات عند الحاجة) */
function applyAutoPlay(
  s: import("../../utils/ludo/types").LudoState,
  sessionId: string,
  startMoveAnim: (a: { tokenId: string; color: LudoColor; keyframes: TokenPos[] }) => void
): import("../../utils/ludo/types").LudoState {
  const tid = s.turnPlayerId;
  if (!tid) return s;

  if (s.lastRoll == null && s.canRoll) {
    const next = reduceHost(s, { type: "ludo_roll", sessionId, fromId: tid });
    return next ?? s;
  }
  if (s.lastRoll != null && s.movableTokenIds.length > 0) {
    const pick = s.movableTokenIds[Math.floor(Math.random() * s.movableTokenIds.length)];
    const pl = s.players.find((p) => p.id === tid);
    const tok = s.tokens.find((x) => x.id === pick);
    if (!pl || !tok || s.lastRoll == null) {
      const next = reduceHost(s, { type: "ludo_move", sessionId, fromId: tid, tokenId: pick });
      return next ?? s;
    }
    const wps = computeMoveWaypoints(pl.color, tok.pos, s.lastRoll);
    if (wps.length === 0) {
      const next = reduceHost(s, { type: "ludo_move", sessionId, fromId: tid, tokenId: pick });
      return next ?? s;
    }
    startMoveAnim({ tokenId: pick, color: pl.color, keyframes: [tok.pos, ...wps] });
    return s;
  }
  return s;
}

/** مدة انزلاق مربع واحد — متوازنة بين وضوء الخطوة وسلاسة السلسلة */
const MOVE_STEP_MS = 132;
/** بداية النبضة داخل نفس مدة الانزلاق (لا تمديد بعد انتهاء الموضع) */
const LAND_DELAY_RATIO = 0.56;
const LAND_POP_MS = 34;
const LAND_SETTLE_MS = 44;
const LAND_SCALE_PEAK = 1.03;
/** ease مادي: انطلاق واستقرار ناعمين بدون «تجمّد» في بداية كل قطعة */
const MOVE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export default function LudoBoardPanel({ sessionId, me, players, onBackToLobby }: Props) {
  const [state, setState] = useState<LudoState>(() =>
    createInitialState({
      sessionId,
      hostId: me.id,
      players: players.map((p) => ({ id: p.id, name: p.name })),
      seedTurnPlayerId: players[0]?.id,
    })
  );
  const [moveAnim, setMoveAnim] = useState<MoveAnim | null>(null);
  const animLeft = useRef(new Animated.Value(0)).current;
  const animTop = useRef(new Animated.Value(0)).current;
  const animHopScale = useRef(new Animated.Value(1)).current;
  const moveRunRef = useRef<{ stop: () => void } | null>(null);
  const turnPulse = useRef(new Animated.Value(0)).current;

  const profileById = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const turnSeconds = 30;
  const [timerLeft, setTimerLeft] = useState(turnSeconds);
  const prevTimerRef = useRef(turnSeconds);

  useEffect(() => {
    setTimerLeft(turnSeconds);
    prevTimerRef.current = turnSeconds;
    const id = setInterval(() => {
      setTimerLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [state.turnPlayerId, state.version]);

  // توهّج/نبض لصاحب الدور الحالي
  useEffect(() => {
    turnPulse.stopAnimation();
    turnPulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(turnPulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(turnPulse, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state.turnPlayerId, turnPulse]);

  /** انتهاء الوقت → رمي أو تحريك تلقائي لصاحب الدور الحالي */
  useEffect(() => {
    if (moveAnim) return;
    if (prevTimerRef.current > 0 && timerLeft === 0) {
      const t = setTimeout(() => {
        setState((s) =>
          applyAutoPlay(s, sessionId, (anim) => {
            setMoveAnim(anim);
          })
        );
      }, 120);
      prevTimerRef.current = timerLeft;
      return () => clearTimeout(t);
    }
    prevTimerRef.current = timerLeft;
  }, [timerLeft, sessionId, moveAnim]);

  /** انزلاق مربع مربع (Animated) ثم تطبيق الحركة في الحالة */
  useEffect(() => {
    if (!moveAnim) return;
    const { tokenId, color, keyframes } = moveAnim;
    if (keyframes.length < 2) {
      setState((s) => reduceHost(s, { type: "ludo_move", sessionId, fromId: s.turnPlayerId, tokenId }) ?? s);
      setMoveAnim(null);
      return;
    }
    moveRunRef.current?.stop?.();
    animHopScale.stopAnimation();
    animHopScale.setValue(1);
    const p0raw = boardPixelForToken(color, tokenId, keyframes[0], BOARD, 0, 0);
    const p0 = clampPawnPixel(p0raw.left, p0raw.top, BOARD);
    animLeft.setValue(p0.left);
    animTop.setValue(p0.top);
    const segments: ReturnType<typeof Animated.parallel>[] = [];
    for (let i = 0; i < keyframes.length - 1; i++) {
      const hops = waypointsForMove(keyframes[i], keyframes[i + 1], color, tokenId, BOARD);
      for (let h = 0; h < hops.length; h++) {
        const target = hops[h];
        const isLastLeg = h === hops.length - 1;
        const dur =
          hops.length === 1 ? MOVE_STEP_MS : h === 0 ? Math.round(MOVE_STEP_MS * 0.5) : Math.round(MOVE_STEP_MS * 0.5);
        const glide = Animated.parallel([
          Animated.timing(animLeft, {
            toValue: target.left,
            duration: dur,
            easing: MOVE_EASING,
            useNativeDriver: false,
          }),
          Animated.timing(animTop, {
            toValue: target.top,
            duration: dur,
            easing: MOVE_EASING,
            useNativeDriver: false,
          }),
        ]);
        if (isLastLeg) {
          const landDelay = Math.round(dur * LAND_DELAY_RATIO);
          const afterDelay = Math.max(0, dur - landDelay);
          const want = LAND_POP_MS + LAND_SETTLE_MS;
          let popMs: number;
          let settleMs: number;
          if (afterDelay >= want) {
            popMs = LAND_POP_MS;
            settleMs = LAND_SETTLE_MS;
          } else if (afterDelay >= 24) {
            popMs = Math.max(12, Math.round(afterDelay * 0.46));
            settleMs = afterDelay - popMs;
          } else {
            popMs = Math.max(8, Math.floor(afterDelay / 2));
            settleMs = afterDelay - popMs;
          }
          const land = Animated.sequence([
            Animated.delay(landDelay),
            Animated.timing(animHopScale, {
              toValue: LAND_SCALE_PEAK,
              duration: popMs,
              easing: Easing.out(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(animHopScale, {
              toValue: 1,
              duration: settleMs,
              easing: Easing.bezier(0.45, 0, 0.55, 1),
              useNativeDriver: true,
            }),
          ]);
          segments.push(Animated.parallel([glide, land]));
        } else {
          segments.push(glide);
        }
      }
    }
    const run = Animated.sequence(segments);
    moveRunRef.current = run;
    run.start(({ finished }) => {
      moveRunRef.current = null;
      if (finished) {
        setState((s) => reduceHost(s, { type: "ludo_move", sessionId, fromId: s.turnPlayerId, tokenId }) ?? s);
        setMoveAnim(null);
      }
    });
    return () => {
      run.stop();
      animHopScale.stopAnimation();
      moveRunRef.current = null;
    };
  }, [moveAnim, sessionId, animLeft, animTop, animHopScale]);

  const canRollNow = state.canRoll && state.lastRoll == null && !moveAnim;
  const mustMoveNow = state.lastRoll != null && state.movableTokenIds.length > 0;

  const onRoll = useCallback(() => {
    if (moveAnim) return;
    setState((s) => reduceHost(s, { type: "ludo_roll", sessionId, fromId: s.turnPlayerId }) ?? s);
  }, [sessionId, moveAnim]);

  const onPickToken = useCallback(
    (tokenId: string) => {
      if (moveAnim) return;
      setState((s) => {
        if (s.lastRoll == null || !s.movableTokenIds.includes(tokenId)) return s;
        const pl = s.players.find((p) => p.id === s.turnPlayerId);
        const tok = s.tokens.find((x) => x.id === tokenId);
        if (!pl || !tok) return s;
        const wps = computeMoveWaypoints(pl.color, tok.pos, s.lastRoll);
        if (wps.length === 0) {
          return reduceHost(s, { type: "ludo_move", sessionId, fromId: s.turnPlayerId, tokenId }) ?? s;
        }
        queueMicrotask(() => setMoveAnim({ tokenId, color: pl.color, keyframes: [tok.pos, ...wps] }));
        return s;
      });
    },
    [sessionId, moveAnim]
  );

  const currentTurnName = state.players.find((p) => p.id === state.turnPlayerId)?.name ?? "";
  const myTurn = state.turnPlayerId === me.id;
  const n = state.players.length;
  const firstWinnerId = state.winners[0] ?? null;
  const firstWinnerName = firstWinnerId ? state.players.find((p) => p.id === firstWinnerId)?.name ?? "" : "";

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => {}} activeOpacity={0.7}>
          <Ionicons name="book-outline" size={24} color={ACCENT_BLUE} />
        </TouchableOpacity>
        <View style={styles.logoBlock}>
          <LinearGradient colors={["#fbbf24", "#f97316", "#ec4899", "#a855f7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoGrad}>
            <Text style={styles.logoText}>LUDO</Text>
          </LinearGradient>
          <View style={styles.logoDecor}>
            <Ionicons name="dice" size={14} color="#78350f" style={{ marginRight: 4 }} />
            <View style={styles.miniPawn} />
            <View style={[styles.miniPawn, { backgroundColor: "#22c55e" }]} />
          </View>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => {}} activeOpacity={0.7}>
            <Ionicons name="trophy" size={22} color="#d97706" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={onBackToLobby} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={26} color={TXT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* صف علوي: لاعب 0 + (نرد ومؤقت بجانب صاحب الدور) | لاعب 1 + نفس الشيء */}
      <View style={styles.avatarTopRow}>
        <PlayerSlot
          player={state.players[0] ? profileById.get(state.players[0].id) : undefined}
          label={state.players[0]?.name}
          color={state.players[0]?.color ?? "red"}
          isTurn={!!state.players[0] && state.turnPlayerId === state.players[0].id}
          showDice={!!state.players[0] && state.turnPlayerId === state.players[0].id}
          lastRoll={state.lastRoll}
          canRoll={canRollNow && !!state.players[0] && state.turnPlayerId === state.players[0].id}
          onRoll={onRoll}
          timerLeft={timerLeft}
          turnSeconds={turnSeconds}
        />
        <PlayerSlot
          player={state.players[1] ? profileById.get(state.players[1].id) : undefined}
          label={state.players[1]?.name}
          color={state.players[1]?.color ?? "green"}
          isTurn={!!state.players[1] && state.turnPlayerId === state.players[1].id}
          showDice={!!state.players[1] && state.turnPlayerId === state.players[1].id}
          lastRoll={state.lastRoll}
          canRoll={canRollNow && !!state.players[1] && state.turnPlayerId === state.players[1].id}
          onRoll={onRoll}
          timerLeft={timerLeft}
          turnSeconds={turnSeconds}
          alignEnd
        />
      </View>

      <View style={[styles.board, { width: BOARD, height: BOARD }]}>
        {/* رسم خط الطريق الأبيض (مربعات المسار) مثل لودو الحقيقي */}
        {TRACK_CELLS.map((cell, idx) => {
          const { x, y } = cellToXY(cell);
          const cellPx = BOARD / 15;
          const TRACK_LEN = 52;
          const inRange = (start: number, k: number) => ((idx - start + TRACK_LEN) % TRACK_LEN) < k;
          const K = 1; // مثل الصورة: أول مربع واحد فقط عند الخروج
          let tint: string | null = null;
          if (inRange(ENTRY_INDEX.red, K)) tint = COLOR_HEX.red;
          else if (inRange(ENTRY_INDEX.green, K)) tint = COLOR_HEX.green;
          else if (inRange(ENTRY_INDEX.yellow, K)) tint = COLOR_HEX.yellow;
          else if (inRange(ENTRY_INDEX.blue, K)) tint = COLOR_HEX.blue;
          return (
            <View
              key={`trk-${idx}`}
              pointerEvents="none"
              style={[
                styles.trackCell,
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  // ضبط دقيق: أبعاد بالـ px (React Native لا يدعم % في margin)
                  width: cellPx,
                  height: cellPx,
                  marginLeft: -cellPx / 2,
                  marginTop: -cellPx / 2,
                  backgroundColor: tint ?? "rgba(255,255,255,0.96)",
                  borderColor: tint ? "rgba(15,23,42,0.25)" : "rgba(148,163,184,0.9)",
                },
              ]}
            />
          );
        })}

        {/* خط البيت (المربعات داخل اللون نحو المركز) */}
        {(Object.keys(HOME_CELLS) as LudoColor[]).flatMap((c) =>
          HOME_CELLS[c].map((cell, i) => {
            const { x, y } = cellToXY(cell);
            const cellPx = BOARD / 15;
            const laneBg = c === "green" ? `${COLOR_HEX.green}66` : `${COLOR_HEX[c]}33`;
            const laneBorder = c === "green" ? `${COLOR_HEX.green}AA` : `${COLOR_HEX[c]}66`;
            return (
              <View
                key={`home-${c}-${i}`}
                pointerEvents="none"
                style={[
                  styles.homeCell,
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    // ضبط دقيق: أبعاد بالـ px (React Native لا يدعم % في margin)
                    width: cellPx,
                    height: cellPx,
                    marginLeft: -cellPx / 2,
                    marginTop: -cellPx / 2,
                    backgroundColor: laneBg,
                    borderColor: laneBorder,
                  },
                ]}
              />
            );
          })
        )}

        <View style={[styles.cornerBase, styles.cornerTL]} />
        <View style={[styles.cornerBase, styles.cornerTR]} />
        <View style={[styles.cornerBase, styles.cornerBL]} />
        <View style={[styles.cornerBase, styles.cornerBR]} />

        {/* داخل كل ربع ملوّن: مربع غامق + 4 دوائر لمواضع القطع (yard) */}
        {(Object.keys(CORNER_POS) as LudoColor[]).map((c) => (
          <View key={`yard-${c}`} pointerEvents="none" style={[styles.yardWrap, CORNER_POS[c]]}>
            <View style={[styles.yardInner, { backgroundColor: `${COLOR_HEX[c]}22`, borderColor: `${COLOR_HEX[c]}66` }]}>
            </View>
          </View>
        ))}

        {/* الدوائر نفسها بمكان القطع "بالضبط" (تستخدم نفس yardSlotXY الذي تستخدمه القطع) */}
        {(Object.keys(CORNER_POS) as LudoColor[]).flatMap((c) =>
          [0, 1, 2, 3].map((slot) => {
            const { x, y } = yardSlotXY(c, slot);
            return (
              <View
                key={`yard-dot-${c}-${slot}`}
                pointerEvents="none"
                style={[
                  styles.yardDot,
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    borderColor: `${COLOR_HEX[c]}AA`,
                  },
                ]}
              />
            );
          })
        )}

        {firstWinnerId ? (
          <View style={styles.crownWrap} pointerEvents="none">
            <View style={styles.crownBadge}>
              <Ionicons name="trophy" size={18} color="#f59e0b" />
              <Text style={styles.crownNum}>1</Text>
            </View>
          </View>
        ) : null}

        {SAFE_STARS.map((idx) => {
          const { x, y } = trackIndexToXY(idx);
          return (
            <View key={`star-${idx}`} style={[styles.starDot, { left: `${x}%`, top: `${y}%` }]}>
              <View style={styles.safeStarBadge}>
                <Ionicons name="star" size={10} color={SAFE_STAR_FG} />
              </View>
            </View>
          );
        })}

        {(Object.keys(ENTRY_INDEX) as LudoColor[]).map((c) => {
          const idx = ENTRY_INDEX[c];
          const { x, y } = trackIndexToXY(idx);
          return (
            <View
              key={`arr-${c}`}
              style={[
                entryArrowStyleForTrackIndex(idx, COLOR_HEX[c]),
                {
                  left: `${x}%`,
                  top: `${y}%`,
                },
              ]}
            />
          );
        })}

        {/* وسط اللودو X مثل الصورة: مربع مُدار 45° + 4 ألوان */}
        <View style={styles.centerCross} pointerEvents="none">
          <View style={styles.centerDiamond}>
            <View key="center-up" style={styles.centerUp} />
            <View key="center-right" style={styles.centerRight} />
            <View key="center-down" style={styles.centerDown} />
            <View key="center-left" style={styles.centerLeft} />
            <View key="center-core" style={styles.centerCore} />
          </View>
        </View>

        {state.tokens.map((tok) => {
          const isAnimatingThis = moveAnim?.tokenId === tok.id;
          const displayPos = tok.pos;
          const { x, y } = tokenRenderPos(tok.color, tok.id, displayPos);
          const movable = mustMoveNow && state.movableTokenIds.includes(tok.id) && !moveAnim;
          const pl = state.players.find((p) => p.color === tok.color);
          const isMine = pl?.id === me.id;
          const isMyColorTurn = !!pl && pl.id === state.turnPlayerId;
          const isYard = tok.pos.kind === "yard";
          const showGlow =
            !moveAnim &&
            isMyColorTurn &&
            state.lastRoll != null &&
            ((state.lastRoll === 6 && isYard && movable) || (state.lastRoll !== 6 && !isYard && movable) || (!isYard && state.lastRoll === 6 && movable));
          const shouldStack = tok.pos.kind !== "yard" && !isAnimatingThis;
          const here = shouldStack
            ? state.tokens.filter((t) => {
                // النهاية: تكديس وجنب بعض داخل ربع اللون فقط (مثل لودو حقيقي)
                if (tok.pos.kind === "finished") {
                  return t.pos.kind === "finished" && t.color === tok.color;
                }
                if (!samePos(t.pos, tok.pos)) return false;
                return true;
              })
            : [tok];
          const order = shouldStack
            ? here
                .slice()
                .sort((a, b) => a.id.localeCompare(b.id))
                .findIndex((t) => t.id === tok.id)
            : 0;
          const baseOff =
            displayPos.kind === "finished"
              ? finishClusterOffset(Math.max(0, order), here.length)
              : shouldStack
                ? stackOffset(Math.max(0, order), here.length)
                : { dx: 0, dy: 0 };
          const dx = baseOff.dx;
          const dy = baseOff.dy;
          const baseScale =
            displayPos.kind === "finished" ? finishClusterScale(here.length) : shouldStack ? stackScale(here.length) : 1;
          const movableScale = movable ? 1.1 : 1;
          const pulseScale = turnPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
          const pulseOpacity = turnPulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.95] });
          return (
            <Animated.View
              key={tok.id}
              pointerEvents="box-none"
              style={[
                styles.pawnWrap,
                isAnimatingThis
                  ? {
                      left: animLeft,
                      top: animTop,
                      transform: [{ translateX: dx }, { translateY: dy }],
                    }
                  : {
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: [
                        { translateX: -12 + dx },
                        { translateY: -12 + dy },
                        { scale: baseScale * movableScale },
                        ...(showGlow ? [{ scale: pulseScale } as any] : []),
                      ],
                    },
              ]}
            >
            {showGlow ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pawnTurnHalo,
                  {
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              />
            ) : null}
            {isAnimatingThis ? (
              <View style={{ transform: [{ scale: baseScale * movableScale }] }}>
                <Animated.View style={[styles.pawnAnimInner, { transform: [{ scale: animHopScale }] }]}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled
                    style={[
                      styles.pawn,
                      {
                        borderColor: COLOR_HEX[tok.color],
                        opacity: tok.pos.kind === "finished" ? 0.92 : 1,
                      },
                      isMine && styles.pawnMine,
                    ]}
                  >
                    <LinearGradient colors={["#ffffff", COLOR_HEX[tok.color]]} style={styles.pawnGrad} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }}>
                      <View style={[styles.pawnCore, { backgroundColor: COLOR_HEX[tok.color] }]} />
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!movable || !!moveAnim}
                onPress={() => onPickToken(tok.id)}
                style={[
                  styles.pawn,
                  {
                    borderColor: COLOR_HEX[tok.color],
                    opacity: tok.pos.kind === "finished" ? 0.92 : 1,
                  },
                  movable && styles.pawnMovableGlow,
                  showGlow && styles.pawnTurnGlow,
                  showGlow && styles.pawnWhiteOutline,
                  isMine && styles.pawnMine,
                ]}
              >
                <LinearGradient colors={["#ffffff", COLOR_HEX[tok.color]]} style={styles.pawnGrad} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }}>
                  <View style={[styles.pawnCore, { backgroundColor: COLOR_HEX[tok.color] }]} />
                </LinearGradient>
              </TouchableOpacity>
            )}
            </Animated.View>
          );
        })}
      </View>

      <Text style={styles.turnHint} numberOfLines={1}>
        {myTurn
          ? mustMoveNow
            ? `حرك قطعة (النرد ${state.lastRoll})`
            : canRollNow
              ? "اضغط النرد أو انتظر انتهاء الوقت"
              : "…"
          : `الدور: ${currentTurnName} (تلقائي عند انتهاء الوقت)`}
      </Text>

      {/* صف سفلي: لاعب 3 و 4 — يظهر من 3 لاعبين فأكثر */}
      {n >= 3 ? (
        <View style={styles.avatarBottomRow}>
          {n >= 4 ? (
            <>
              {/* أزرق يسار (زاوية الأزرق في اللوحة) | أصفر يمين (زاوية الأصفر) */}
              <PlayerSlot
                compact
                player={state.players[3] ? profileById.get(state.players[3].id) : undefined}
                label={state.players[3]?.name}
                color={state.players[3]?.color ?? "blue"}
                isTurn={!!state.players[3] && state.turnPlayerId === state.players[3].id}
                showDice={!!state.players[3] && state.turnPlayerId === state.players[3].id}
                lastRoll={state.lastRoll}
                canRoll={canRollNow && !!state.players[3] && state.turnPlayerId === state.players[3].id}
                onRoll={onRoll}
                timerLeft={timerLeft}
                turnSeconds={turnSeconds}
              />
              <PlayerSlot
                compact
                player={state.players[2] ? profileById.get(state.players[2].id) : undefined}
                label={state.players[2]?.name}
                color={state.players[2]?.color ?? "yellow"}
                isTurn={!!state.players[2] && state.turnPlayerId === state.players[2].id}
                showDice={!!state.players[2] && state.turnPlayerId === state.players[2].id}
                lastRoll={state.lastRoll}
                canRoll={canRollNow && !!state.players[2] && state.turnPlayerId === state.players[2].id}
                onRoll={onRoll}
                timerLeft={timerLeft}
                turnSeconds={turnSeconds}
                alignEnd
              />
            </>
          ) : (
            <>
              <PlayerSlot
                compact
                player={state.players[2] ? profileById.get(state.players[2].id) : undefined}
                label={state.players[2]?.name}
                color={state.players[2]?.color ?? "yellow"}
                isTurn={!!state.players[2] && state.turnPlayerId === state.players[2].id}
                showDice={!!state.players[2] && state.turnPlayerId === state.players[2].id}
                lastRoll={state.lastRoll}
                canRoll={canRollNow && !!state.players[2] && state.turnPlayerId === state.players[2].id}
                onRoll={onRoll}
                timerLeft={timerLeft}
                turnSeconds={turnSeconds}
              />
              <View style={styles.bottomRowSpacer} />
            </>
          )}
        </View>
      ) : null}

      {firstWinnerId ? <Text style={styles.winBanner}>مبروك {firstWinnerName} — مركز أول</Text> : null}
    </View>
  );
}

/** صف: صورة + اسم + (إن كان دوره) نرد + مؤقت */
function PlayerSlot({
  player,
  label,
  color,
  isTurn,
  showDice,
  lastRoll,
  canRoll,
  onRoll,
  timerLeft,
  turnSeconds,
  compact,
  alignEnd,
}: {
  player?: PlayerLite;
  label?: string;
  color: LudoColor;
  isTurn: boolean;
  showDice: boolean;
  lastRoll: number | null;
  canRoll: boolean;
  onRoll: () => void;
  timerLeft: number;
  turnSeconds: number;
  compact?: boolean;
  alignEnd?: boolean;
}) {
  const ring = compact ? styles.pbRingSm : styles.pbRing;
  const img = compact ? styles.pbImgSm : styles.pbImg;

  const inner = (
    <>
      <View style={[ring, isTurn && styles.pbRingOn, { borderColor: COLOR_HEX[color] }]}>
        {player?.profileImage ? (
          <Image source={{ uri: String(player.profileImage) }} style={img} />
        ) : (
          <View style={[img, styles.pbFb]}>
            <Ionicons name="person" size={compact ? 14 : 18} color={TXT} />
          </View>
        )}
      </View>
      <Text style={[styles.pbName, styles.pbNameLight]} numberOfLines={1}>
        {label ?? ""}
      </Text>
    </>
  );

  return (
    <View style={[styles.playerSlotRow, alignEnd && styles.playerSlotRowEnd]}>
      <View style={styles.pbCol}>{inner}</View>
      {showDice ? (
        <View style={[styles.diceBeside, alignEnd && styles.diceBesideRev]}>
          <TouchableOpacity
            style={[styles.diceBtn, !canRoll && styles.diceBtnDim]}
            onPress={onRoll}
            disabled={!canRoll}
            activeOpacity={0.88}
          >
            <LinearGradient colors={["#60a5fa", "#2563eb", "#1d4ed8"]} style={styles.diceInner}>
              <Ionicons name="dice" size={20} color="#eff6ff" />
              <Text style={[styles.diceNum, lastRoll != null && styles.diceNumGlow]}>{lastRoll != null ? lastRoll : "?"}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={[styles.timerRing, styles.timerRingPad]}>
            <View style={[styles.timerArc, { height: `${(timerLeft / turnSeconds) * 100}%` }]} />
            <Text style={styles.timerNum}>{timerLeft}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.diceSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", alignItems: "center", paddingBottom: 4 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  topBarRight: { flexDirection: "row", alignItems: "center" },
  iconBtn: { width: 42, height: 44, alignItems: "center", justifyContent: "center" },
  logoBlock: { flex: 1, alignItems: "center" },
  logoGrad: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#a855f7",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  logoText: { fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: 3, textShadowColor: "rgba(0,0,0,0.25)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
  logoDecor: { flexDirection: "row", alignItems: "center", marginTop: 4, opacity: 0.85 },
  miniPawn: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444", marginHorizontal: 2 },

  avatarTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: BOARD + 32,
    marginBottom: 8,
    alignItems: "flex-end",
  },
  avatarBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: BOARD + 32,
    marginTop: 10,
    alignItems: "flex-end",
  },

  playerSlotRow: { flexDirection: "row", alignItems: "center", maxWidth: BOARD / 2 + 100 },
  playerSlotRowEnd: { flexDirection: "row-reverse", alignItems: "center" },

  pbCol: { alignItems: "center", maxWidth: 80 },
  diceBeside: { flexDirection: "row", alignItems: "center", marginLeft: 4 },
  diceBesideRev: { flexDirection: "row", alignItems: "center", marginRight: 4 },
  timerRingPad: { marginLeft: 4 },
  diceSpacer: { width: 96, minHeight: 52 },
  bottomRowSpacer: { width: BOARD / 2 },

  board: {
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#c4b5fd",
    overflow: "visible",
    position: "relative",
    shadowColor: "#6366f1",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  trackCell: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.9)",
    borderRadius: 4,
    zIndex: 1,
  },
  homeCell: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 4,
    zIndex: 1,
  },
  cornerBase: {
    position: "absolute",
    width: "42%",
    height: "42%",
    opacity: 0.95,
  },
  cornerTL: { top: 0, left: 0, backgroundColor: "#fecaca", borderBottomRightRadius: 36 },
  cornerTR: { top: 0, right: 0, backgroundColor: "#bbf7d0", borderBottomLeftRadius: 36 },
  cornerBL: { bottom: 0, left: 0, backgroundColor: "#bfdbfe", borderTopRightRadius: 36 },
  cornerBR: { bottom: 0, right: 0, backgroundColor: "#fef08a", borderTopLeftRadius: 36 },

  yardWrap: {
    position: "absolute",
    width: "42%",
    height: "42%",
    zIndex: 1,
  },
  yardInner: {
    position: "absolute",
    left: "16%",
    top: "16%",
    width: "68%",
    height: "68%",
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  yardDot: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 6, // مربع دائري (شكل حديث ومرتب)
    marginLeft: -9,
    marginTop: -9,
    borderWidth: 2,
    backgroundColor: "rgba(15, 23, 42, 0.22)",
    zIndex: 2,
  },
  crownWrap: {
    position: "absolute",
    left: "6%",
    top: "6%",
    zIndex: 3,
    alignItems: "center",
  },
  crownBadge: {
    width: 38,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(15, 23, 42, 0.10)",
    borderWidth: 2,
    borderColor: "rgba(245, 158, 11, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  crownNum: { position: "absolute", right: 4, bottom: 2, fontSize: 11, fontWeight: "900", color: "#92400e" },
  starDot: {
    position: "absolute",
    zIndex: 2,
    // توسيط شارة النجمة 16×16 على مركز المربع تماماً
    marginLeft: -8,
    marginTop: -8,
  },
  safeStarBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SAFE_STAR_BG,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.18)",
    zIndex: 3,
  },
  centerCross: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  centerDiamond: {
    // حجم محاذي تقريباً لصندوق 3×3 مربعات في شبكة 15×15
    width: "20%",
    height: "20%",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.9)",
    transform: [{ rotate: "45deg" }],
    borderRadius: 6,
    overflow: "hidden",
    zIndex: 6,
  },
  // 4 أرباع داخل المربع المُدار: ستظهر كـ X (مثل الصورة) بدون تداخل يغطي الأخضر
  centerUp: { position: "absolute", left: 0, top: 0, width: "50%", height: "50%", backgroundColor: COLOR_HEX.green },
  centerRight: { position: "absolute", right: 0, top: 0, width: "50%", height: "50%", backgroundColor: COLOR_HEX.yellow },
  centerDown: { position: "absolute", right: 0, bottom: 0, width: "50%", height: "50%", backgroundColor: COLOR_HEX.blue },
  centerLeft: { position: "absolute", left: 0, bottom: 0, width: "50%", height: "50%", backgroundColor: COLOR_HEX.red },
  centerCore: {
    position: "absolute",
    left: "38%",
    top: "38%",
    width: "24%",
    height: "24%",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "rgba(15,23,42,0.25)",
    borderRadius: 4,
  },
  pawn: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 8,
  },
  pawnWrap: {
    position: "absolute",
    zIndex: 8,
    overflow: "visible",
  },
  /** توسيط نبضة الحركة حول مركز القطعة */
  pawnAnimInner: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pawnTurnHalo: {
    position: "absolute",
    left: -10,
    top: -10,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: "rgba(255,255,255,0.16)",
    shadowColor: "#ffffff",
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 20,
  },
  pawnGrad: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pawnCore: { width: 11, height: 11, borderRadius: 5.5, opacity: 0.95 },
  pawnMovableGlow: {
    shadowColor: "#fbbf24",
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 12,
  },
  pawnTurnGlow: {
    shadowColor: "#ffffff",
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 22,
  },
  pawnWhiteOutline: {
    borderColor: "#ffffff",
    borderWidth: 3,
  },
  pawnMine: { borderColor: "#fff", borderWidth: 3 },

  turnHint: { color: TXT_MUTED, fontSize: 11, marginTop: 8, marginBottom: 4, paddingHorizontal: 8, textAlign: "center" },

  diceBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#2563eb",
    shadowOpacity: 0.65,
    shadowRadius: 12,
    elevation: 10,
  },
  diceBtnDim: { opacity: 0.45 },
  diceInner: { flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", paddingVertical: 4 },
  diceNum: { fontSize: 12, fontWeight: "900", color: "#eff6ff", marginTop: -1 },
  diceNumGlow: {
    textShadowColor: "rgba(255,255,255,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  timerRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#22c55e",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  timerArc: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(34,197,94,0.4)",
  },
  timerNum: { fontSize: 10, fontWeight: "800", color: TXT, zIndex: 1 },

  pbRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  pbRingSm: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  pbRingOn: { borderWidth: 3, shadowColor: "#fbbf24", shadowOpacity: 0.85, shadowRadius: 8 },
  pbImg: { width: "100%", height: "100%" },
  pbImgSm: { width: "100%", height: "100%" },
  pbFb: { alignItems: "center", justifyContent: "center", backgroundColor: "#e2e8f0" },
  pbName: { fontSize: 10, marginTop: 4, maxWidth: 76, textAlign: "center" },
  pbNameLight: { color: TXT },

  winBanner: { color: "#fde68a", fontWeight: "900", marginTop: 10, fontSize: 14, textAlign: "center" },
});
