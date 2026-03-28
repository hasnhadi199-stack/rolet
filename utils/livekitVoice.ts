/**
 * LiveKit voice integration for group chat.
 * Requires @livekit/react-native and development build (not Expo Go).
 */

import { RoomEvent, DataPacket_Kind } from "livekit-client";

export type LiveKitVoiceState = "disconnected" | "connecting" | "connected" | "error";

let currentState: LiveKitVoiceState = "disconnected";
let roomInstance: {
  localParticipant: {
    setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
    audioLevel: number;
    isSpeaking: boolean;
    publishData?: (data: Uint8Array, kind?: any) => Promise<void> | void;
  };
  on: (event: string, fn: (...args: unknown[]) => void) => void;
  off: (event: string, fn: (...args: unknown[]) => void) => void;
  setSpeakerMute?: (muted: boolean) => void;
} | null = null;

type LiveKitDataHandler = (message: any, raw: Uint8Array) => void;
const dataHandlers = new Set<LiveKitDataHandler>();

function safeJsonParse(txt: string): any | null {
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function toText(payload: any): string {
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload ?? {});
}

export function subscribeToLiveKitData(cb: LiveKitDataHandler): () => void {
  dataHandlers.add(cb);
  return () => dataHandlers.delete(cb);
}

export async function sendLiveKitData(message: any, kind: "reliable" | "lossy" = "reliable"): Promise<boolean> {
  const room = roomInstance as any;
  if (!room?.localParticipant?.publishData) return false;
  try {
    const txt = toText(message);
    const bytes = new TextEncoder().encode(txt);
    const lkKind = kind === "lossy" ? (DataPacket_Kind as any).LOSSY : (DataPacket_Kind as any).RELIABLE;
    await room.localParticipant.publishData(bytes, lkKind);
    return true;
  } catch (err) {
    if (__DEV__) console.warn("[LiveKit] publishData error:", err);
    return false;
  }
}

export function getLiveKitVoiceState(): LiveKitVoiceState {
  return currentState;
}

export function setLiveKitVoiceState(state: LiveKitVoiceState): void {
  currentState = state;
}

/**
 * كتم/إلغاء كتم السماعة (لا تسمع المستخدمين على المايك)
 */
export function setLiveKitSpeakerMute(muted: boolean): void {
  try {
    if (roomInstance?.setSpeakerMute) {
      roomInstance.setSpeakerMute(muted);
    }
  } catch (err) {
    if (__DEV__) console.warn("[LiveKit] setSpeakerMute error:", err);
  }
}

/**
 * الاشتراك بمستوى الصوت الفعلي من LiveKit — الموجات تظهر فقط عند التأكد من أن صوتك يُبث
 * يعيد دالة إلغاء الاشتراك
 */
export function subscribeToLocalAudio(cb: (audioLevel: number, isSpeaking: boolean) => void): () => void {
  const room = roomInstance;
  if (!room) {
    cb(0, false);
    return () => {};
  }
  /** تقليل إعادة رسم الشاشة: كان 48ms ≈ 21 مرة/ثانية */
  const POLL_MS = 200;
  const MIN_EMIT_MS = 160;
  let lastLevel = -1;
  let lastSpeaking = false;
  let lastEmitAt = 0;

  const handler = () => {
    const lp = room.localParticipant;
    const level = lp.audioLevel ?? 0;
    const speaking = lp.isSpeaking ?? false;
    const now = Date.now();
    const speakingChanged = speaking !== lastSpeaking;
    const levelDelta = Math.abs(level - lastLevel);
    const timeOk = now - lastEmitAt >= MIN_EMIT_MS;
    if (!speakingChanged && levelDelta < 0.05 && !timeOk) return;
    lastLevel = level;
    lastSpeaking = speaking;
    lastEmitAt = now;
    cb(level, speaking);
  };
  room.on(RoomEvent.ActiveSpeakersChanged, handler);
  handler();
  const iv = setInterval(handler, POLL_MS);
  return () => {
    room.off(RoomEvent.ActiveSpeakersChanged, handler);
    clearInterval(iv);
  };
}

/**
 * تفعيل/إيقاف المايكروفون (قطع الصوت المباشر أو إظهاره)
 */
export async function setLiveKitMicrophoneEnabled(enabled: boolean): Promise<void> {
  if (!roomInstance?.localParticipant) return;
  try {
    await roomInstance.localParticipant.setMicrophoneEnabled(enabled);
  } catch (err) {
    if (__DEV__) console.warn("[LiveKit] setMicrophoneEnabled error:", err);
  }
}

/**
 * Connect to LiveKit room with token and wsUrl.
 * Returns cleanup function to disconnect.
 */
export async function connectLiveKitVoice(
  token: string,
  wsUrl: string,
  _roomName?: string
): Promise<() => void> {
  const url = (wsUrl || "").trim() || "wss://cloud.livekit.cloud";
  try {
    setLiveKitVoiceState("connecting");
    const { Room } = await import("livekit-client");
    const room = new Room();
    await room.connect(url, token, {
      autoSubscribe: true,
      maxRetries: 2,
      websocketTimeout: 8000,
      peerConnectionTimeout: 10000,
    });
    roomInstance = room as any;

    const onData = (payload: Uint8Array) => {
      const txt = new TextDecoder().decode(payload);
      const obj = safeJsonParse(txt) ?? txt;
      for (const h of dataHandlers) {
        try {
          h(obj, payload);
        } catch (e) {
          if (__DEV__) console.warn("[LiveKit] data handler error:", e);
        }
      }
    };
    room.on(RoomEvent.DataReceived, onData as any);
    setLiveKitVoiceState("connected");
    return () => {
      roomInstance = null;
      try {
        room.off(RoomEvent.DataReceived, onData as any);
      } catch {}
      room.disconnect();
      setLiveKitVoiceState("disconnected");
    };
  } catch (err) {
    setLiveKitVoiceState("error");
    if (__DEV__) console.warn("[LiveKit] connect failed:", err);
    throw err;
  }
}
