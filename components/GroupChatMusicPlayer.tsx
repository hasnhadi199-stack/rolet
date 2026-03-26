import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import {
  getGroupChatMusicState,
  groupChatMusicControl,
  type GroupChatMusicState,
} from "../utils/messagesApi";
import { API_BASE_URL } from "../utils/authHelper";

const BG = "#1a1625";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const ACCENT = "#a78bfa";

function toAbsoluteUrl(url: string | null): string | null {
  if (!url?.trim()) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  /** تشغيل مباشر من الملف المحلي أثناء الرفع دون انتظار السيرفر */
  if (url.startsWith("file://") || url.startsWith("content://")) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}${url}`;
}

const WAVE_BARS = 8;
const POLL_INTERVAL = 100;
const STATE_FRESH_MS = 2 * 60 * 1000; // لا تشغيل تلقائي إلا إذا الحالة حديثة (دقيقتين)

type Props = {
  /** يُعرض لوحة التحكم الكاملة (عند false يُعرض شريط مصغّر) */
  visible?: boolean;
  /** عند الضغط على زر الإغلاق */
  onClose?: () => void;
  /** عند الضغط على الشريط المصغّر للتوسيع */
  onExpand?: () => void;
  /** عند تغيّر حالة الموسيقى */
  onStateChange?: (state: GroupChatMusicState | null) => void;
  /** يُحدَّث للجلب الفوري (بعد اختيار أغنية مثلاً) */
  refreshTrigger?: number;
  /** حالة فورية من API التشغيل — تشغيل الأغنية فوراً دون انتظار الاستطلاع */
  immediateState?: GroupChatMusicState | null;
  /** عند استهلاك immediateState */
  onImmediateStateConsumed?: () => void;
  /** جاري رفع أغنية */
  uploading?: boolean;
  /** يمكن التحكم (تشغيل/إيقاف) — فقط لمن على المايك */
  canControl?: boolean;
};

const STOP_IGNORE_MS = 3000; // تجاهل تشغيل من الاستطلاع لمدة 3 ثواني بعد إيقاف المستخدم

export default function GroupChatMusicPlayer({ visible = true, onClose, onExpand, onStateChange, refreshTrigger, immediateState, onImmediateStateConsumed, uploading, canControl = true }: Props) {
  const [state, setState] = useState<GroupChatMusicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const playingUrlRef = useRef<string | null>(null);
  const lastStoppedAtRef = useRef<number>(0);
  const playRequestIdRef = useRef(0);
  const fetchStateInFlight = useRef(false);
  const waveAnims = useRef<Animated.Value[]>(
    Array.from({ length: WAVE_BARS }, () => new Animated.Value(0.3))
  ).current;
  const waveLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const fetchState = useCallback(async () => {
    if (uploading) return;
    if (fetchStateInFlight.current) return;
    fetchStateInFlight.current = true;
    let s: Awaited<ReturnType<typeof getGroupChatMusicState>> = null;
    try {
      s = await getGroupChatMusicState();
    } finally {
      fetchStateInFlight.current = false;
    }
    if (s) {
      const justStopped = Date.now() - lastStoppedAtRef.current < STOP_IGNORE_MS;
      const effectivePlaying = s.isPlaying && !justStopped;
      const effectiveState = effectivePlaying ? s : { ...s, isPlaying: false };
      setState(effectiveState);
      const isFresh = (s.updatedAt || 0) > Date.now() - STATE_FRESH_MS;
      onStateChange?.(isFresh ? effectiveState : { ...effectiveState, isPlaying: false });
    }
  }, [onStateChange, uploading]);

  useEffect(() => {
    fetchState();
    const t = setInterval(fetchState, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchState]);

  useEffect(() => {
    if (refreshTrigger != null) void fetchState();
  }, [refreshTrigger, fetchState]);

  useEffect(() => {
    if (immediateState && immediateState.url) {
      const fresh = { ...immediateState, updatedAt: immediateState.updatedAt || Date.now() };
      setState(fresh);
      onStateChange?.(fresh);
      onImmediateStateConsumed?.();
    }
  }, [immediateState]); // eslint-disable-line react-hooks/exhaustive-deps

  const playLocal = useCallback(async (url: string) => {
    const absUrl = toAbsoluteUrl(url);
    if (!absUrl) return;
    const myId = ++playRequestIdRef.current;
    try {
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch {}
        soundRef.current = null;
        playingUrlRef.current = null;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: 1,
        interruptionModeIOS: 1,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: absUrl },
        { shouldPlay: true, volume: state?.volume ?? 1 }
      );
      if (myId !== playRequestIdRef.current) {
        sound.unloadAsync().catch(() => {});
        return;
      }
      soundRef.current = sound;
      playingUrlRef.current = absUrl;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish && !status.isLooping) {
          void groupChatMusicControl("next").then((s) => {
            if (s) {
              setState(s);
              onStateChange?.(s);
            }
          });
        }
      });
    } catch (e) {
      if (__DEV__) console.warn("[MusicPlayer] playLocal error:", e);
      setError("فشل تشغيل الأغنية");
    }
  }, [state?.volume, onStateChange]);

  const stopLocal = useCallback(async () => {
    playRequestIdRef.current++;
    playingUrlRef.current = null;
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!state) return;
    const isFresh = (state.updatedAt || 0) > Date.now() - STATE_FRESH_MS;
    if (state.isPlaying && state.url && isFresh) {
      playLocal(state.url);
      setError(null);
    } else {
      stopLocal();
    }
    return () => {
      void stopLocal();
    };
  }, [state?.isPlaying, state?.url, state?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (soundRef.current && state?.volume != null) {
      soundRef.current.setVolumeAsync(state.volume);
    }
  }, [state?.volume]);

  const startWaveAnimation = useCallback(() => {
    if (waveLoopRef.current) return;
    const anims = waveAnims.map((v, i) =>
      Animated.sequence([
        Animated.timing(v, {
          toValue: 0.2 + Math.random() * 0.8,
          duration: 80 + i * 20,
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0.25,
          duration: 70,
          useNativeDriver: true,
        }),
      ])
    );
    waveLoopRef.current = Animated.loop(
      Animated.stagger(55, anims.map((a) => a))
    );
    waveLoopRef.current.start();
  }, [waveAnims]);

  const stopWaveAnimation = useCallback(() => {
    if (waveLoopRef.current) {
      waveLoopRef.current.stop();
      waveLoopRef.current = null;
    }
    waveAnims.forEach((v) => v.setValue(0.25));
  }, [waveAnims]);

  useEffect(() => {
    if (state?.isPlaying) startWaveAnimation();
    else stopWaveAnimation();
    return stopWaveAnimation;
  }, [state?.isPlaying, startWaveAnimation, stopWaveAnimation]);

  const handlePlay = useCallback(async () => {
    if (!state?.url) return;
    setState((prev) => (prev ? { ...prev, isPlaying: true } : null));
    const s = await groupChatMusicControl("play", { url: state.url });
    if (s) {
      setState(s);
      onStateChange?.(s);
    }
  }, [state?.url, onStateChange]);

  const handleStop = useCallback(async () => {
    lastStoppedAtRef.current = Date.now();
    setState((prev) => (prev ? { ...prev, isPlaying: false } : null));
    await stopLocal();
    const s = await groupChatMusicControl("stop");
    if (s) {
      setState({ ...s, isPlaying: false });
      onStateChange?.({ ...s, isPlaying: false });
    }
  }, [onStateChange, stopLocal]);

  const handleNext = useCallback(async () => {
    const s = await groupChatMusicControl("next");
    if (s) {
      setState(s);
      onStateChange?.(s);
    }
  }, [onStateChange]);

  const handlePrev = useCallback(async () => {
    const s = await groupChatMusicControl("prev");
    if (s) {
      setState(s);
      onStateChange?.(s);
    }
  }, [onStateChange]);

  const handleVolume = useCallback(async (delta: number) => {
    const current = state?.volume ?? 1;
    const next = Math.max(0, Math.min(1, current + delta));
    setState((prev) => (prev ? { ...prev, volume: next } : null));
    const s = await groupChatMusicControl("volume", { volume: next });
    if (s) {
      setState(s);
      onStateChange?.(s);
    }
  }, [state?.volume, onStateChange]);

  const isFresh = state && (state.updatedAt || 0) > Date.now() - STATE_FRESH_MS;
  const hasMusic = state && (state.url || state.playlist.length > 0) && isFresh;
  if (!hasMusic && !uploading) return null;

  if (uploading && !hasMusic) {
    return (
      <TouchableOpacity style={styles.collapsedBar} activeOpacity={0.9}>
        <Ionicons name="musical-notes" size={18} color={ACCENT} />
        <Text style={styles.collapsedText}>جاري التشغيل...</Text>
      </TouchableOpacity>
    );
  }

  const songName =
    state?.url?.split("/").pop()?.replace(/\.(mp3|m4a|aac)$/i, "") || "أغنية";

  if (!visible && onExpand) {
    return (
      <TouchableOpacity style={styles.collapsedBar} onPress={onExpand} activeOpacity={0.7}>
        <Ionicons name="musical-notes" size={18} color={ACCENT} />
        <Text style={styles.collapsedText} numberOfLines={1}>{songName}</Text>
        <Ionicons name="chevron-up" size={16} color={TEXT_MUTED} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {onClose && canControl ? (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={20} color={TEXT_LIGHT} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.waveRow}>
        {waveAnims.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.waveBar,
              {
                opacity: state?.isPlaying ? 1 : 0.4,
                transform: [
                  {
                    scaleY: v,
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="musical-notes" size={18} color={ACCENT} />
        <Text style={styles.songName} numberOfLines={1}>
          {songName}
        </Text>
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={handlePrev}
          disabled={!state?.playlist?.length}
        >
          <Ionicons
            name="play-skip-back"
            size={22}
            color={state?.playlist?.length ? TEXT_LIGHT : TEXT_MUTED}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, styles.mainBtn]}
          onPress={state?.isPlaying ? handleStop : handlePlay}
          activeOpacity={0.7}
          disabled={!canControl}
        >
          <Ionicons
            name={state?.isPlaying ? "stop" : "play"}
            size={26}
            color="#fff"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={handleNext}
          disabled={!canControl || !state?.playlist?.length}
        >
          <Ionicons
            name="play-skip-forward"
            size={22}
            color={state?.playlist?.length ? TEXT_LIGHT : TEXT_MUTED}
          />
        </TouchableOpacity>
        <View style={styles.volumeRow}>
          <TouchableOpacity
            style={styles.volumeBtn}
            onPress={() => handleVolume(-0.2)}
            disabled={!canControl}
          >
            <Ionicons name="volume-low" size={18} color={canControl ? TEXT_LIGHT : TEXT_MUTED} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.volumeBtn}
            onPress={() => handleVolume(0.2)}
            disabled={!canControl}
          >
            <Ionicons name="volume-high" size={18} color={canControl ? TEXT_LIGHT : TEXT_MUTED} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    position: "relative",
    backgroundColor: "rgba(45, 38, 64, 0.7)",
    borderTopWidth: 1,
    borderTopColor: "rgba(167, 139, 250, 0.2)",
    gap: 12,
  },
  waveRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 24,
    gap: 3,
  },
  waveBar: {
    width: 4,
    height: 16,
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  infoRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  songName: {
    fontSize: 13,
    color: TEXT_LIGHT,
    flex: 1,
  },
  errorText: {
    fontSize: 11,
    color: "#ef4444",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  controlBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  mainBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  volumeBtn: {
    padding: 4,
  },
  closeBtn: {
    position: "absolute",
    top: 6,
    left: 8,
    zIndex: 10,
    padding: 4,
  },
  collapsedBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(45, 38, 64, 0.7)",
    borderTopWidth: 1,
    borderTopColor: "rgba(167, 139, 250, 0.2)",
    gap: 8,
  },
  collapsedText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_LIGHT,
  },
});
