import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { LudoColor, LudoState, TokenPos } from "../../utils/ludo/types";
import { createInitialState, reduceHost } from "../../utils/ludo/ludoEngine";
import { cellToXY, COLOR_HEX, ENTRY_INDEX, entryArrowStyleForTrackIndex, HOME_CELLS, homeStepXY, TRACK_CELLS, trackIndexToXY, yardSlotXY } from "../../utils/ludo/boardLayout";

/** مربعات آمنة — مطابقة للمحرك */
const SAFE_STARS = [0, 8, 13, 21, 26, 34, 39, 47];

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

const COLORS: LudoColor[] = ["red", "green", "yellow", "blue"];

const FINISH_OFFSET: Record<LudoColor, { x: number; y: number }> = {
  red: { x: 47, y: 48 },
  green: { x: 53, y: 48 },
  yellow: { x: 53, y: 52 },
  blue: { x: 47, y: 52 },
};

function tokenRenderPos(color: LudoColor, id: string, pos: TokenPos): { x: number; y: number } {
  const slot = parseInt(id.split("-")[1] || "0", 10) % 4;
  if (pos.kind === "yard") return yardSlotXY(color, slot);
  if (pos.kind === "track") return trackIndexToXY(pos.index);
  if (pos.kind === "home") return homeStepXY(color, pos.step);
  return FINISH_OFFSET[color];
}

const CORNER_POS: Record<LudoColor, { left?: string; right?: string; top?: string; bottom?: string }> = {
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

/** لعب تلقائي: رمي أو أول/عشوائي تحريك */
function applyAutoPlay(s: import("../../utils/ludo/types").LudoState, sessionId: string): import("../../utils/ludo/types").LudoState {
  const tid = s.turnPlayerId;
  if (!tid) return s;

  if (s.lastRoll == null && s.canRoll) {
    const next = reduceHost(s, { type: "ludo_roll", sessionId, fromId: tid });
    return next ?? s;
  }
  if (s.lastRoll != null && s.movableTokenIds.length > 0) {
    const pick = s.movableTokenIds[Math.floor(Math.random() * s.movableTokenIds.length)];
    const next = reduceHost(s, { type: "ludo_move", sessionId, fromId: tid, tokenId: pick });
    return next ?? s;
  }
  return s;
}

export default function LudoBoardPanel({ sessionId, me, players, onBackToLobby }: Props) {
  const [state, setState] = useState<LudoState>(() =>
    createInitialState({
      sessionId,
      hostId: me.id,
      players: players.map((p) => ({ id: p.id, name: p.name })),
      seedTurnPlayerId: players[0]?.id,
    })
  );

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

  /** انتهاء الوقت → رمي أو تحريك تلقائي لصاحب الدور الحالي */
  useEffect(() => {
    if (prevTimerRef.current > 0 && timerLeft === 0) {
      const t = setTimeout(() => {
        setState((s) => applyAutoPlay(s, sessionId));
      }, 120);
      prevTimerRef.current = timerLeft;
      return () => clearTimeout(t);
    }
    prevTimerRef.current = timerLeft;
  }, [timerLeft, sessionId]);

  const canRollNow = state.canRoll && state.lastRoll == null;
  const mustMoveNow = state.lastRoll != null && state.movableTokenIds.length > 0;

  const onRoll = useCallback(() => {
    setState((s) => reduceHost(s, { type: "ludo_roll", sessionId, fromId: s.turnPlayerId }) ?? s);
  }, [sessionId]);

  const onPickToken = useCallback(
    (tokenId: string) => {
      setState((s) => {
        if (s.lastRoll == null || !s.movableTokenIds.includes(tokenId)) return s;
        return reduceHost(s, { type: "ludo_move", sessionId, fromId: s.turnPlayerId, tokenId }) ?? s;
      });
    },
    [sessionId]
  );

  const currentTurnName = state.players.find((p) => p.id === state.turnPlayerId)?.name ?? "";
  const myTurn = state.turnPlayerId === me.id;
  const n = state.players.length;

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
          color={COLORS[0]}
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
          color={COLORS[1]}
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
                  // ملاصقة: خلية كاملة بدون فراغ
                  width: `${CELL_PCT}%`,
                  height: `${CELL_PCT}%`,
                  marginLeft: `-${CELL_PCT / 2}%`,
                  marginTop: `-${CELL_PCT / 2}%`,
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
                    // ملاصقة: خلية كاملة بدون فراغ
                    width: `${CELL_PCT}%`,
                    height: `${CELL_PCT}%`,
                    marginLeft: `-${CELL_PCT / 2}%`,
                    marginTop: `-${CELL_PCT / 2}%`,
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

        <View style={styles.crownWrap}>
          <Ionicons name="star" size={24} color="#eab308" />
          <Text style={styles.crownNum}>1</Text>
        </View>

        {SAFE_STARS.map((idx) => {
          const { x, y } = trackIndexToXY(idx);
          return (
            <View key={`star-${idx}`} style={[styles.starDot, { left: `${x}%`, top: `${y}%` }]}>
              <Ionicons name="star" size={9} color="#fbbf24" />
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
            <View style={styles.centerUp} />
            <View style={styles.centerRight} />
            <View style={styles.centerDown} />
            <View style={styles.centerLeft} />
            <View style={styles.centerCore} />
          </View>
        </View>

        {state.tokens.map((tok) => {
          const { x, y } = tokenRenderPos(tok.color, tok.id, tok.pos);
          const movable = mustMoveNow && state.movableTokenIds.includes(tok.id);
          const pl = state.players.find((p) => p.color === tok.color);
          const isMine = pl?.id === me.id;
          const shouldStack = tok.pos.kind !== "yard";
          const here = shouldStack ? state.tokens.filter((t) => samePos(t.pos, tok.pos)) : [tok];
          const order = shouldStack
            ? here
                .slice()
                .sort((a, b) => a.id.localeCompare(b.id))
                .findIndex((t) => t.id === tok.id)
            : 0;
          const { dx, dy } = shouldStack ? stackOffset(Math.max(0, order), here.length) : { dx: 0, dy: 0 };
          return (
            <TouchableOpacity
              key={tok.id}
              activeOpacity={0.85}
              disabled={!movable}
              onPress={() => onPickToken(tok.id)}
              style={[
                styles.pawn,
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  borderColor: COLOR_HEX[tok.color],
                  opacity: tok.pos.kind === "finished" ? 0.35 : 1,
                  transform: [
                    { translateX: -12 + dx },
                    { translateY: -12 + dy },
                    ...(movable ? [{ scale: 1.1 } as const] : []),
                  ],
                },
                movable && styles.pawnMovableGlow,
                isMine && styles.pawnMine,
              ]}
            >
              <LinearGradient colors={["#ffffff", COLOR_HEX[tok.color]]} style={styles.pawnGrad} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={[styles.pawnCore, { backgroundColor: COLOR_HEX[tok.color] }]} />
              </LinearGradient>
            </TouchableOpacity>
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
          <PlayerSlot
            compact
            player={state.players[2] ? profileById.get(state.players[2].id) : undefined}
            label={state.players[2]?.name}
            color={COLORS[2]}
            isTurn={!!state.players[2] && state.turnPlayerId === state.players[2].id}
            showDice={!!state.players[2] && state.turnPlayerId === state.players[2].id}
            lastRoll={state.lastRoll}
            canRoll={canRollNow && !!state.players[2] && state.turnPlayerId === state.players[2].id}
            onRoll={onRoll}
            timerLeft={timerLeft}
            turnSeconds={turnSeconds}
          />
          {n >= 4 ? (
            <PlayerSlot
              compact
              player={state.players[3] ? profileById.get(state.players[3].id) : undefined}
              label={state.players[3]?.name}
              color={COLORS[3]}
              isTurn={!!state.players[3] && state.turnPlayerId === state.players[3].id}
              showDice={!!state.players[3] && state.turnPlayerId === state.players[3].id}
              lastRoll={state.lastRoll}
              canRoll={canRollNow && !!state.players[3] && state.turnPlayerId === state.players[3].id}
              onRoll={onRoll}
              timerLeft={timerLeft}
              turnSeconds={turnSeconds}
              alignEnd
            />
          ) : (
            <View style={styles.bottomRowSpacer} />
          )}
        </View>
      ) : null}

      {state.winners.length > 0 ? (
        <Text style={styles.winBanner}>🏆 {state.players.find((p) => p.id === state.winners[0])?.name}</Text>
      ) : null}
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
              <Text style={styles.diceNum}>{lastRoll != null ? lastRoll : "?"}</Text>
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
  crownNum: { fontSize: 11, fontWeight: "900", color: "#a16207", marginTop: -2 },
  starDot: {
    position: "absolute",
    zIndex: 2,
    marginLeft: -6,
    marginTop: -6,
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
  centerUp: { position: "absolute", left: 0, top: 0, width: "100%", height: "50%", backgroundColor: COLOR_HEX.green },
  centerDown: { position: "absolute", left: 0, bottom: 0, width: "100%", height: "50%", backgroundColor: COLOR_HEX.blue },
  centerLeft: { position: "absolute", left: 0, top: 0, width: "50%", height: "100%", backgroundColor: COLOR_HEX.red },
  centerRight: { position: "absolute", right: 0, top: 0, width: "50%", height: "100%", backgroundColor: COLOR_HEX.yellow },
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

  winBanner: { color: ACCENT_BLUE, fontWeight: "800", marginTop: 10, fontSize: 15 },
});
