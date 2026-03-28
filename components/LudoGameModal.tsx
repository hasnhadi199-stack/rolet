import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Image, TouchableWithoutFeedback, Platform, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import LudoBoardPanel from "./ludo/LudoBoardPanel";

const TEXT = "#f5f3ff";
const MUTED = "#a1a1aa";
const ACCENT = "#38bdf8";
const CARD = "rgba(45, 38, 64, 0.6)";

const { width: W } = Dimensions.get("window");

type PlayerLite = { id: string; name: string; profileImage?: string | null };

type Props = {
  visible: boolean;
  onClose: () => void;
  me: PlayerLite;
  /** candidates (e.g. from roomUsers), used for quick start */
  candidates: PlayerLite[];
  sessionId?: string; // default "group-chat-room"
};

const FAREWELL_MS = 2200;

/** 4 خانات: [أنت، لاعب؟، لاعب؟، لاعب؟] */
function emptySlots(me: PlayerLite): (PlayerLite | null)[] {
  return [me, null, null, null];
}

export default function LudoGameModal({ visible, onClose, me, candidates, sessionId = "group-chat-room" }: Props) {
  const [phase, setPhase] = useState<"lobby" | "play">("lobby");
  const [gameKey, setGameKey] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [slots, setSlots] = useState<(PlayerLite | null)[]>(() => emptySlots(me));
  /** عند الضغط على + نفتح اختيار من يملأ هذه الخانة (1–3) */
  const [pickSlotIndex, setPickSlotIndex] = useState<number | null>(null);
  const [farewell, setFarewell] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible) {
      setFarewell(false);
      setPhase("lobby");
      setHasStarted(false);
      setGameKey((k) => k + 1); // reset فقط عند الإغلاق
      fade.setValue(0);
      scale.setValue(0.92);
    }
  }, [visible, fade, scale]);

  const prevVisibleRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      prevVisibleRef.current = false;
      return;
    }
    const justOpened = !prevVisibleRef.current;
    prevVisibleRef.current = true;
    if (justOpened) {
      setSlots(emptySlots(me));
      setPickSlotIndex(null);
    } else {
      setSlots((prev) => {
        if (prev.length !== 4) return emptySlots(me);
        return [me, prev[1], prev[2], prev[3]];
      });
    }
  }, [visible, me.id, me.name, me.profileImage]);

  useEffect(() => {
    if (!farewell) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 65, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      onCloseRef.current();
    }, FAREWELL_MS);
    return () => clearTimeout(t);
  }, [farewell, fade, scale]);

  const requestClose = useCallback(() => {
    if (farewell) return;
    if (phase === "play") {
      setPhase("lobby");
      return;
    }
    setFarewell(true);
  }, [farewell, phase]);

  const startGame = useCallback(() => {
    const pl = slots.filter((x): x is PlayerLite => x != null);
    if (pl.length < 2) return;
    setPhase("play");
    setHasStarted(true);
  }, [slots]);

  const toggleChip = useCallback(
    (p: PlayerLite) => {
      if (p.id === me.id) return;
      setSlots((prev) => {
        const at = prev.findIndex((x, i) => i > 0 && x?.id === p.id);
        if (at !== -1) {
          const next = [...prev];
          next[at] = null;
          return next;
        }
        const emptyIdx = prev.findIndex((x, i) => i > 0 && x === null);
        if (emptyIdx === -1) return prev;
        const next = [...prev];
        next[emptyIdx] = p;
        return next;
      });
    },
    [me.id]
  );

  const assignToSlot = useCallback((slotIndex: number, p: PlayerLite) => {
    if (slotIndex <= 0 || slotIndex > 3 || p.id === me.id) return;
    setSlots((prev) => {
      const next = [...prev];
      for (let i = 1; i < 4; i++) {
        if (next[i]?.id === p.id) next[i] = null;
      }
      next[slotIndex] = p;
      return next;
    });
    setPickSlotIndex(null);
  }, [me.id]);

  const clearSlot = useCallback((slotIndex: number) => {
    if (slotIndex <= 0) return;
    setSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  }, []);

  const filledCount = slots.filter(Boolean).length;
  const availableForPicker = candidates.filter(
    (c) => c.id !== me.id && !slots.some((s) => s?.id === c.id)
  );

  const headerTitle = "لودو";

  if (farewell) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
        <LinearGradient colors={["#12081c", "#1e1035", "#0f172a"]} style={styles.farewellRoot} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.farewellGlow} pointerEvents="none" />
          <Animated.View style={[styles.farewellCardWrap, { opacity: fade, transform: [{ scale }] }]}>
            <LinearGradient colors={["rgba(251,191,36,0.25)", "rgba(56,189,248,0.2)", "rgba(167,139,250,0.22)"]} style={styles.farewellCardBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={styles.farewellCardInner}>
                <View style={styles.farewellDiceRow}>
                  <View style={[styles.farewellDot, { backgroundColor: "#f87171" }]} />
                  <View style={[styles.farewellDot, { backgroundColor: "#34d399" }]} />
                  <View style={[styles.farewellDot, { backgroundColor: "#fbbf24" }]} />
                  <View style={[styles.farewellDot, { backgroundColor: "#60a5fa" }]} />
                </View>
                <View style={styles.farewellIconRing}>
                  <LinearGradient colors={["#fbbf24", "#f59e0b"]} style={styles.farewellIconGrad}>
                    <Ionicons name="dice" size={44} color="#1c1917" />
                  </LinearGradient>
                </View>
                <Text style={styles.farewellTitle}>تم إغلاق اللعبة</Text>
                <Text style={styles.farewellSub}>شكراً للعب، إلى اللقاء في جولة جديدة</Text>
                <View style={styles.farewellStars}>
                  <Ionicons name="sparkles" size={18} color="rgba(251,191,36,0.9)" />
                  <Ionicons name="heart" size={16} color="rgba(244,114,182,0.85)" style={{ marginHorizontal: 10 }} />
                  <Ionicons name="sparkles" size={18} color="rgba(56,189,248,0.9)" />
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </LinearGradient>
      </Modal>
    );
  }

  const lobbyPlayers = slots.filter((x): x is PlayerLite => x != null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
            <View style={[styles.sheet, phase === "play" && styles.sheetGame, phase === "play" && styles.sheetPlayShell]}>
              {phase === "lobby" ? (
              <View style={styles.sheetHeader}>
                <Text style={styles.title}>{headerTitle}</Text>
                <TouchableOpacity onPress={requestClose} style={styles.headerBtn} activeOpacity={0.6}>
                  <Ionicons name="close" size={22} color={TEXT} />
                </TouchableOpacity>
              </View>
              ) : null}

              {/* اللعب يبقى مركّب (لا reset) — نخفي/نُظهر فقط */}
              {hasStarted ? (
                <View style={[styles.sheetPlayGradient, phase !== "play" && styles.hidden]}>
                  <ScrollView
                    style={styles.gameScroll}
                    contentContainerStyle={styles.gameScrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <LudoBoardPanel
                      key={gameKey}
                      sessionId={sessionId}
                      me={me}
                      players={lobbyPlayers}
                      onBackToLobby={() => setPhase("lobby")}
                    />
                  </ScrollView>
                </View>
              ) : null}

              {phase !== "play" ? (
              <View style={styles.card}>
          <Text style={styles.sectionTitle}>اختر اللاعبين</Text>

          <View style={styles.slotsRow}>
            {[0, 1, 2, 3].map((i) => {
              const p = slots[i] ?? null;
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  style={styles.slotCircle}
                  onPress={() => {
                    if (i === 0) return;
                    if (p?.id && p.id !== me.id) {
                      clearSlot(i);
                      return;
                    }
                    if (!p) setPickSlotIndex(i);
                  }}
                >
                  {p?.profileImage ? (
                    <Image source={{ uri: String(p.profileImage) }} style={styles.slotAvatar} />
                  ) : p ? (
                    <View style={[styles.slotAvatar, styles.slotAvatarFallback]}>
                      <Ionicons name="person" size={22} color={TEXT} />
                    </View>
                  ) : (
                    <View style={[styles.slotAvatar, styles.slotAvatarPlus]}>
                      <Ionicons name="add" size={24} color={TEXT} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.hintText}>اضغط + لإضافة لاعب من الغرفة — تظهر صورته في الدائرة</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.candidatesRow}>
            {candidates
              .filter((c) => c.id !== me.id)
              .map((c) => {
                const picked = slots.some((s) => s?.id === c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.7}
                    style={[styles.candidateChip, picked && styles.candidateChipPicked]}
                    onPress={() => toggleChip(c)}
                  >
                    {c.profileImage ? <Image source={{ uri: String(c.profileImage) }} style={styles.candidateAvatar} /> : <View style={[styles.candidateAvatar, styles.slotAvatarFallback]} />}
                    <Text style={styles.candidateName} numberOfLines={1}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.startBtn, filledCount < 2 && styles.startBtnDisabled]}
            activeOpacity={0.7}
            onPress={startGame}
            disabled={filledCount < 2}
          >
            <Ionicons name="play" size={18} color={TEXT} />
            <Text style={styles.startBtnText}>ابدء</Text>
          </TouchableOpacity>

          {pickSlotIndex !== null ? (
            <Modal visible transparent animationType="fade" onRequestClose={() => setPickSlotIndex(null)}>
              <TouchableWithoutFeedback onPress={() => setPickSlotIndex(null)}>
                <View style={styles.pickerBackdrop}>
                  <TouchableWithoutFeedback onPress={() => {}}>
                    <View style={styles.pickerCard}>
                      <Text style={styles.pickerTitle}>اختر لاعباً للانضمام</Text>
                      {availableForPicker.length === 0 ? (
                        <Text style={styles.pickerEmpty}>لا يوجد مستخدمون متاحون — تأكد أنهم في الغرفة</Text>
                      ) : (
                        <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
                          {availableForPicker.map((c) => (
                            <TouchableOpacity
                              key={c.id}
                              style={styles.pickerRow}
                              activeOpacity={0.7}
                              onPress={() => pickSlotIndex != null && assignToSlot(pickSlotIndex, c)}
                            >
                              {c.profileImage ? (
                                <Image source={{ uri: String(c.profileImage) }} style={styles.pickerAvatar} />
                              ) : (
                                <View style={[styles.pickerAvatar, styles.slotAvatarFallback]}>
                                  <Ionicons name="person" size={20} color={TEXT} />
                                </View>
                              )}
                              <Text style={styles.pickerName} numberOfLines={1}>
                                {c.name}
                              </Text>
                              <Ionicons name="chevron-back" size={18} color={MUTED} />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                      <TouchableOpacity style={styles.pickerCancel} onPress={() => setPickSlotIndex(null)} activeOpacity={0.7}>
                        <Text style={styles.pickerCancelText}>إلغاء</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          ) : null}
              </View>
              ) : null}
            </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  farewellRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  farewellGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(168,85,247,0.12)",
    opacity: 0.9,
  },
  farewellCardWrap: { width: "100%", maxWidth: 340, alignItems: "center" },
  farewellCardBorder: {
    borderRadius: 28,
    padding: 2,
    width: "100%",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  farewellCardInner: {
    backgroundColor: "rgba(15,10,28,0.92)",
    borderRadius: 26,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  farewellDiceRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  farewellDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  farewellIconRing: {
    marginBottom: 20,
    borderRadius: 999,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
  },
  farewellIconGrad: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  farewellTitle: { color: "#fef3c7", fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  farewellSub: { color: "rgba(226,232,240,0.85)", fontSize: 14, textAlign: "center", lineHeight: 22 },
  farewellStars: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#1e1b2e",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    marginBottom: 60,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  sheetGame: { marginBottom: 24, maxHeight: "92%" },
  /** شيت اللعب: خلفية شفافة ليظهر التدرج */
  sheetPlayShell: { backgroundColor: "transparent", paddingHorizontal: 0, paddingTop: 0 },
  sheetPlayGradient: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    flexGrow: 1,
    minHeight: 420,
  },
  hidden: { display: "none" },
  gameScroll: { maxHeight: Dimensions.get("window").height * 0.78 },
  gameScrollContent: { paddingBottom: 16, alignItems: "center" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  headerBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { color: TEXT, fontSize: 16, fontWeight: "700" },
  card: { backgroundColor: CARD, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(167,139,250,0.25)" },
  sectionTitle: { color: TEXT, fontSize: 13, fontWeight: "700", marginBottom: 10 },
  hintText: { color: MUTED, fontSize: 11, textAlign: "center", marginBottom: 8, lineHeight: 16 },
  slotsRow: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  slotCircle: { width: 62, height: 62, borderRadius: 31, overflow: "hidden", borderWidth: 1, borderColor: "rgba(56,189,248,0.35)", backgroundColor: "rgba(255,255,255,0.06)" },
  slotAvatar: { width: "100%", height: "100%" },
  slotAvatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  slotAvatarPlus: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(56,189,248,0.16)" },
  candidatesRow: { gap: 10, paddingVertical: 6 },
  candidateChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  candidateChipPicked: { borderColor: "rgba(56,189,248,0.6)", backgroundColor: "rgba(56,189,248,0.12)" },
  candidateAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.10)" },
  candidateName: { color: TEXT, fontSize: 12, maxWidth: W * 0.38 },
  startBtn: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(56,189,248,0.22)", borderWidth: 1, borderColor: "rgba(56,189,248,0.35)" },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { color: TEXT, fontSize: 13, fontWeight: "800" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 },
  pickerCard: {
    backgroundColor: "#252036",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.3)",
    maxHeight: W * 0.55,
  },
  pickerTitle: { color: TEXT, fontSize: 15, fontWeight: "800", marginBottom: 12, textAlign: "center" },
  pickerEmpty: { color: MUTED, fontSize: 13, textAlign: "center", paddingVertical: 16 },
  pickerList: { maxHeight: W * 0.42 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 8,
  },
  pickerAvatar: { width: 40, height: 40, borderRadius: 20 },
  pickerName: { flex: 1, color: TEXT, fontSize: 14, fontWeight: "600" },
  pickerCancel: { marginTop: 8, paddingVertical: 10, alignItems: "center" },
  pickerCancelText: { color: ACCENT, fontSize: 14, fontWeight: "700" },
});

