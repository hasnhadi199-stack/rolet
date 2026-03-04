import { StyleSheet, Text, View, TouchableOpacity, Image, TextInput, Platform, ScrollView, KeyboardAvoidingView, Dimensions, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import type { UserSearchResult } from "../../utils/usersApi";
import { useEffect, useRef, useState, useCallback } from "react";
import { sendMessage, fetchThread, deleteMessage, uploadVoiceMessage, fetchVoiceToLocalUri, getVoicePlaybackUrl, type ChatMessage } from "../../utils/messagesApi";

type CurrentUser = {
  id?: string;
  name?: string;
  profileImage?: string;
};

type Props = {
  me: CurrentUser | null;
  other: UserSearchResult;
  onBack: () => void;
};

const BG = "#141028";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const INPUT_BG = "rgba(255,255,255,0.04)";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.64;
const MAX_VOICE_SEC = 30;

// صفوف الإيموجي الظاهرة في لوحة الإيموجي
// ✌️ سيتم استخدامها لتشغيل لعبة حجر-ورقة-مقص
// 🎲 سيتم استخدامها لتشغيل نرد عشوائي
const EMOJI_ROWS: string[][] = [
  ["😘", "🤣", "🌹", "✌️", "🙂", "😂"],
  ["😊", "🥲", "🥰", "😉", "😁", "😄"],
  ["😅", "😆", "😎", "🙂", "😃", "🎲"],
];

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ChatScreen({ me, other, onBack }: Props) {
  type LocalStatus = "sending" | "sent" | "failed";
  type LocalChatMessage = ChatMessage & {
    status?: LocalStatus;
    replyToText?: string | null;
    specialType?: "dice" | "rps";
    specialAnimating?: boolean;
  };
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<LocalChatMessage | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState<number>(0);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchThread(other.id).then((list) => {
      if (cancelled) return;
      setMessages(list.map((m) => ({ ...m, status: "sent" })));
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 50);
    });
    return () => {
      cancelled = true;
    };
  }, [other.id]);

  const stopRecordingAndCleanup = useCallback(() => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingSec(0);
  }, []);

  const handleStopVoice = useCallback(async (overrideDuration?: number) => {
    const rec = recordingRef.current;
    if (!rec || !me?.id) {
      stopRecordingAndCleanup();
      return;
    }
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      stopRecordingAndCleanup();
      if (!uri) return;
      const durationSec = overrideDuration ?? Math.min(Math.max(recordingSec, 1), MAX_VOICE_SEC);
      const up = await uploadVoiceMessage(uri);
      if (!up) return;
      const optimistic: LocalChatMessage = {
        id: `local-${Date.now()}`,
        fromId: me.id,
        toId: other.id,
        text: "🎤 رسالة صوتية",
        createdAt: new Date().toISOString(),
        status: "sending",
        audioUrl: up.audioUrl,
        audioDurationSeconds: durationSec,
      };
      setMessages((prev) => [...prev, optimistic]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);
      const sent = await sendMessage(other.id, "🎤 رسالة صوتية", null, up.audioUrl, durationSec);
      if (sent) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimistic.id ? { ...sent, status: "sent" } : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, status: "failed" } : m))
        );
      }
    } catch (e) {
      console.log("stop voice error:", e);
    } finally {
      recordingRef.current = null;
      stopRecordingAndCleanup();
    }
  }, [me?.id, other.id, recordingSec, stopRecordingAndCleanup]);

  const handleStartVoice = useCallback(async () => {
    if (!me?.id || isRecording) return;
    try {
      // إلغاء أي تسجيل سابق لم يُنهَ بشكل صحيح
      const prev = recordingRef.current;
      if (prev) {
        try {
          await prev.stopAndUnloadAsync();
        } catch {}
        recordingRef.current = null;
        await new Promise((r) => setTimeout(r, 300));
      }
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingSec(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSec((s) => {
          if (s >= MAX_VOICE_SEC - 1) {
            stopRecordingAndCleanup();
            if (recordingIntervalRef.current) {
              clearInterval(recordingIntervalRef.current);
              recordingIntervalRef.current = null;
            }
            handleStopVoice(MAX_VOICE_SEC);
            return 0;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      console.log("start voice error:", e);
      stopRecordingAndCleanup();
    }
  }, [me?.id, isRecording, stopRecordingAndCleanup, handleStopVoice]);

  const handleSend = async () => {
    if (!me?.id || !text.trim()) return;
    const trimmed = text.trim();
    const optimistic: LocalChatMessage = {
      id: `local-${Date.now()}`,
      fromId: me.id,
      toId: other.id,
      text: trimmed,
      createdAt: new Date().toISOString(),
      status: "sending",
      replyToText: replyTo?.text ?? null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);
    setText("");
    setReplyTo(null);
    setActiveMenuId(null);
    const sent = await sendMessage(other.id, optimistic.text, optimistic.replyToText ?? null);
    if (sent) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...sent, status: "sent", replyToText: optimistic.replyToText ?? null } : m
        )
      );
    } else {
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...m, status: "failed" } : m)));
    }
  };

  const retrySend = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status: "sending" } : m)));
    const sent = await sendMessage(
      other.id,
      msg.text,
      msg.replyToText ?? null,
      msg.audioUrl ?? null,
      msg.audioDurationSeconds ?? null
    );
    if (sent) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...sent, status: "sent" } : m)));
    } else {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status: "failed" } : m)));
    }
  };

  const handleDelete = async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setActiveMenuId(null);
    await deleteMessage(messageId);
  };

  const handleToggleEmoji = () => {
    setShowEmojiPicker((prev) => !prev);
  };

  const handleSendDice = useCallback(() => {
    if (!me?.id) return;
    const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    const id = `local-dice-${Date.now()}`;
    const optimistic: LocalChatMessage = {
      id,
      fromId: me.id,
      toId: other.id,
      text: "🎲",
      createdAt: new Date().toISOString(),
      status: "sending",
      specialType: "dice",
      specialAnimating: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);

    const totalSteps = 18; // ~2 ثانية (18 * 110ms)
    const finalIndex = Math.floor(Math.random() * faces.length);

    const spin = (step: number) => {
      if (step < totalSteps) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, text: faces[step % faces.length] }
              : m
          )
        );
        setTimeout(() => spin(step + 1), 110);
      } else {
        const face = faces[finalIndex];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, text: face, specialAnimating: false }
              : m
          )
        );
        // إرسال النتيجة النهائية إلى الباك إند
        void (async () => {
          const sent = await sendMessage(other.id, face, null);
          if (sent) {
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...sent, status: "sent" } : m))
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id ? { ...m, status: "failed" } : m
              )
            );
          }
        })();
      }
    };

    spin(0);
  }, [me?.id, other.id]);

  const handleSendRps = useCallback(() => {
    if (!me?.id) return;
    const variants = ["✊", "✋", "✌️"];
    const id = `local-rps-${Date.now()}`;
    const optimistic: LocalChatMessage = {
      id,
      fromId: me.id,
      toId: other.id,
      text: "✊",
      createdAt: new Date().toISOString(),
      status: "sending",
      specialType: "rps",
      specialAnimating: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);

    const totalSteps = 12;
    const finalIndex = Math.floor(Math.random() * variants.length);

    const spin = (step: number) => {
      if (step < totalSteps) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, text: variants[step % variants.length] }
              : m
          )
        );
        setTimeout(() => spin(step + 1), 110);
      } else {
        const final = variants[finalIndex];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, text: final, specialAnimating: false }
              : m
          )
        );
        void (async () => {
          const sent = await sendMessage(other.id, final, null);
          if (sent) {
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...sent, status: "sent" } : m))
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id ? { ...m, status: "failed" } : m
              )
            );
          }
        })();
      }
    };

    spin(0);
  }, [me?.id, other.id]);

  const handlePickEmoji = (emoji: string) => {
    if (emoji === "🎲") {
      setShowEmojiPicker(false);
      void handleSendDice();
      return;
    }
    if (emoji === "✌️") {
      setShowEmojiPicker(false);
      void handleSendRps();
      return;
    }
    setText((prev) => (prev || "") + emoji);
  };

  const handlePlayVoice = useCallback(async (msg: LocalChatMessage) => {
    if (!msg.audioUrl) return;
    if (playingId === msg.id) {
      try {
        const s = soundRef.current;
        if (s) {
          const st = await s.getStatusAsync();
          if (st?.isLoaded && (st as { isPlaying?: boolean }).isPlaying) {
            await s.pauseAsync();
          } else {
            await s.playAsync();
          }
        }
      } catch {
        setPlayingId(null);
      }
      return;
    }
    if (loadingVoiceId) return;
    setLoadingVoiceId(msg.id);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: 1,
        interruptionModeIOS: 1,
      });
      if (soundRef.current) await soundRef.current.unloadAsync();

      let playUri: string | null = await fetchVoiceToLocalUri(msg.audioUrl);
      if (playUri && !playUri.startsWith("file://")) playUri = `file://${playUri}`;

      if (!playUri) {
        playUri = await getVoicePlaybackUrl(msg.audioUrl);
      }

      if (!playUri) {
        setLoadingVoiceId(null);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: playUri },
        { shouldPlay: true, isLooping: false, volume: 1 }
      );
      await sound.setVolumeAsync(1);
      soundRef.current = sound;
      setPlayingId(msg.id);
      setPlaybackPosition(0);
      sound.setOnPlaybackStatusUpdate((st: any) => {
        if (!st?.isLoaded) return;
        setPlaybackPosition(Math.floor((st.positionMillis || 0) / 1000));
        const done = (st.didJustFinish && !st.isPlaying) ||
          (st.positionMillis >= (st.durationMillis || 1) - 50);
        if (done) {
          setPlayingId(null);
          setPlaybackPosition(0);
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      console.log("play voice error:", e);
      setPlayingId(null);
    } finally {
      setLoadingVoiceId(null);
    }
  }, [playingId, loadingVoiceId]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    };
  }, []);

  const renderBubbleContent = (m: LocalChatMessage, isMine: boolean, status: LocalStatus) => {
    const isVoice = !!m.audioUrl;
    const dur = m.audioDurationSeconds ?? 0;

    if (isVoice) {
      const loading = loadingVoiceId === m.id;
      return (
        <View style={styles.voiceRow}>
          <TouchableOpacity
            style={styles.voicePlayBtn}
            onPress={() => handlePlayVoice(m)}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={isMine ? "#fff" : TEXT_LIGHT} />
            ) : (
              <Ionicons
                name={playingId === m.id ? "pause" : "play"}
                size={18}
                color={isMine ? "#fff" : TEXT_LIGHT}
              />
            )}
          </TouchableOpacity>
          <Text style={[styles.voiceDuration, isMine ? styles.voiceDurationMine : styles.voiceDurationOther]}>
            {playingId === m.id ? `${fmtDuration(playbackPosition)} / ${fmtDuration(dur)}` : fmtDuration(dur)}
          </Text>
        </View>
      );
    }
    return (
      <>
        <Text style={isMine ? styles.myMsgText : styles.otherMsgText}>{m.text}</Text>
        {isMine && status === "failed" && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => retrySend(m.id)} style={styles.failedRow}>
            <Ionicons name="alert-circle" size={14} color="#f87171" />
            <Text style={styles.failedText}>لم يتم الإرسال · أعد المحاولة</Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={TEXT_LIGHT} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.avatarsRow}>
              {me?.profileImage ? (
                <Image source={{ uri: me.profileImage }} style={styles.headerAvatarSmall} />
              ) : (
                <View style={[styles.headerAvatarSmall, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={18} color={TEXT_MUTED} />
                </View>
              )}
              {other.profileImage ? (
                <Image source={{ uri: other.profileImage }} style={styles.headerAvatarSmall} />
              ) : (
                <View style={[styles.headerAvatarSmall, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={18} color={TEXT_MUTED} />
                </View>
              )}
            </View>
            <Text style={styles.otherName} numberOfLines={1}>{other.name}</Text>
            <Text style={styles.otherId}>{other.id}</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.messagesContainer} ref={scrollRef}>
          {messages.map((m) => {
            const isMine = m.fromId === me?.id;
            const status: LocalStatus = m.status || "sent";
            return (
              <View key={m.id} style={isMine ? styles.myMsgRow : styles.otherMsgRow}>
                {!isMine && (
                  other.profileImage ? (
                    <Image source={{ uri: other.profileImage }} style={styles.msgAvatarOther} />
                  ) : (
                    <View style={[styles.msgAvatarOther, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={18} color={TEXT_MUTED} />
                    </View>
                  )
                )}
                <View style={isMine ? styles.myMsgSideMine : styles.myMsgSideOther}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onLongPress={() => setActiveMenuId(m.id)}
                    delayLongPress={220}
                  >
                    <View style={isMine ? styles.myMsgBubble : styles.otherMsgBubble}>
                      {!!m.replyToText && (
                        <View style={styles.replyPreviewInBubble}>
                          <Text style={styles.replyPreviewText}>{m.replyToText}</Text>
                        </View>
                      )}
                      {renderBubbleContent(m, isMine, status)}
                    </View>
                  </TouchableOpacity>
                  {activeMenuId === m.id && (
                    <View style={styles.messageMenu}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.menuBtn}
                        onPress={() => { setReplyTo(m); setActiveMenuId(null); }}
                      >
                        <Text style={styles.menuBtnText}>رد</Text>
                      </TouchableOpacity>
                      {isMine && (
                        <TouchableOpacity activeOpacity={0.8} style={styles.menuBtn} onPress={() => handleDelete(m.id)}>
                          <Text style={styles.menuBtnText}>سحب</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
                {isMine && (
                  me?.profileImage ? (
                    <Image source={{ uri: me.profileImage }} style={styles.msgAvatarMine} />
                  ) : (
                    <View style={[styles.msgAvatarMine, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={18} color={TEXT_MUTED} />
                    </View>
                  )
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.inputArea}>
          {isRecording && (
            <View style={styles.recordingBar}>
              <View style={styles.recordingWave} />
              <Text style={styles.recordingText}>جاري التسجيل {fmtDuration(recordingSec)}</Text>
              <TouchableOpacity onPress={() => handleStopVoice()} style={styles.recordingStopBtn}>
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          {replyTo && !isRecording && (
            <View style={styles.replyBar}>
              <View style={styles.replyBarLeft}>
                <View style={styles.replyBarLine} />
                <Text style={styles.replyBarLabel}>الرد على</Text>
              </View>
              <Text numberOfLines={1} style={styles.replyBarText}>{replyTo.text}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close" size={16} color={TEXT_MUTED} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.mainInputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="اكتب رسالة..."
              placeholderTextColor={TEXT_MUTED}
              multiline
              value={text}
              onChangeText={setText}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              onFocus={() => setShowEmojiPicker(false)}
            />
            <TouchableOpacity onPress={handleSend} disabled={!text.trim()} activeOpacity={0.8}>
              <Ionicons name="send" size={22} color={text.trim() ? "#4ade80" : TEXT_MUTED} />
            </TouchableOpacity>
          </View>

          {showEmojiPicker && (
            <View style={styles.emojiPanel}>
              {EMOJI_ROWS.map((row, idx) => (
                <View key={idx} style={styles.emojiRow}>
                  {row.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.emojiBtn}
                      activeOpacity={0.8}
                      onPress={() => handlePickEmoji(emoji)}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          )}

          <View style={styles.bottomActions}>
            <View style={styles.leftActions}>
              <TouchableOpacity
                onPress={handleStartVoice}
                activeOpacity={0.8}
                disabled={isRecording}
              >
                {isRecording ? (
                  <ActivityIndicator size="small" color="#f87171" />
                ) : (
                  <Ionicons name="mic" size={22} color="#60a5fa" />
                )}
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} onPress={handleToggleEmoji}>
                <Ionicons name="happy-outline" size={22} color={TEXT_MUTED} />
              </TouchableOpacity>
            </View>
            <View style={styles.rightActions}>
              <TouchableOpacity activeOpacity={0.8}>
                <Ionicons name="image-outline" size={22} color={TEXT_MUTED} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8}>
                <Ionicons name="gift-outline" size={22} color="#fbbf24" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingTop: Platform.OS === "ios" ? 40 : 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.25)",
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.85)",
  },
  headerCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  avatarsRow: { flexDirection: "row-reverse", alignItems: "center", marginBottom: 2 },
  headerAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.9)",
    marginLeft: -8,
  },
  avatarPlaceholder: {
    backgroundColor: "rgba(31,41,55,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  otherName: { fontSize: 15, fontWeight: "700", color: TEXT_LIGHT },
  otherId: { fontSize: 11, color: TEXT_MUTED },
  messagesContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 5 },
  myMsgRow: { flexDirection: "row-reverse", alignItems: "flex-end", marginBottom: 8, paddingHorizontal: 4 },
  otherMsgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 8, paddingHorizontal: 4 },
  myMsgBubble: {
    marginTop: -1,
    maxWidth: BUBBLE_MAX_WIDTH,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    backgroundColor: "#a855f7",
    minWidth: 80,
    alignSelf: "flex-end",
  },
  myMsgText: { fontSize: 14, color: "#fff" },
  otherMsgBubble: {
    maxWidth: BUBBLE_MAX_WIDTH,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    backgroundColor: "rgba(15,23,42,0.9)",
  },
  otherMsgText: { fontSize: 14, color: TEXT_LIGHT },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  voicePlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceDuration: { fontSize: 13, fontWeight: "600" },
  voiceDurationMine: { color: "#fff" },
  voiceDurationOther: { color: TEXT_LIGHT },
  myMsgSideMine: { alignItems: "flex-end", gap: 4, flexShrink: 0 },
  myMsgSideOther: { flex: 1, alignItems: "flex-start", gap: 4 },
  replyPreviewInBubble: {
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderRightWidth: 2,
    borderRightColor: "#e9d5ff",
    backgroundColor: "rgba(29, 53, 107, 0.92)",
    width: "100%",
  },
  replyPreviewText: { fontSize: 12, color: "#e5e7eb" },
  failedRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end" },
  failedText: { fontSize: 11, color: "#f87171", fontWeight: "700" },
  msgAvatarMine: { width: 34, height: 34, borderRadius: 8, marginLeft: 6 },
  msgAvatarOther: { width: 34, height: 34, borderRadius: 8, marginRight: 6 },
  inputArea: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.9)",
    backgroundColor: BG,
    gap: 8,
  },
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.15)",
  },
  recordingWave: {
    width: 8,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#f87171",
  },
  recordingText: { flex: 1, fontSize: 13, color: "#fca5a5", fontWeight: "600" },
  recordingStopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  mainInputRow: {
    backgroundColor: INPUT_BG,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: { flex: 1, minHeight: 22, maxHeight: 80, color: TEXT_LIGHT, textAlignVertical: "center" },
  emojiPanel: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.98)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)",
    gap: 4,
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  emojiBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 999,
  },
  emojiText: {
    fontSize: 24,
  },
  bottomActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  leftActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  rightActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  messageMenu: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)",
  },
  menuBtnText: { fontSize: 11, color: TEXT_LIGHT, fontWeight: "600" },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.9)",
  },
  replyBarLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  replyBarLine: { width: 2, height: 18, borderRadius: 999, backgroundColor: "#a855f7" },
  replyBarLabel: { fontSize: 11, color: TEXT_MUTED },
  replyBarText: { flex: 1, fontSize: 12, color: TEXT_LIGHT },
  specialBubbleCenter: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  diceEmoji: {
    fontSize: 32,
  },
  diceLottie: {
    width: 120,
    height: 120,
  },
  rpsEmoji: {
    fontSize: 32,
  },
  specialHint: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
});
