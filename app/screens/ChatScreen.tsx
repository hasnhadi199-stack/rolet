import { StyleSheet, Text, View, TouchableOpacity, TouchableWithoutFeedback, Image, TextInput, Platform, ScrollView, KeyboardAvoidingView, Dimensions, ActivityIndicator, Modal, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import LottieView from "lottie-react-native";
import type { UserSearchResult } from "../../utils/usersApi";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { sendMessage, fetchThread, getCachedThread, deleteMessage, uploadVoiceMessage, uploadImageMessage, fetchVoiceToLocalUri, getVoicePlaybackUrl, buildSenderForNotification, type ChatMessage } from "../../utils/messagesApi";
import { fetchWallet } from "../../utils/walletApi";
import { claimFiveMessagesBonus, setLocalClaimedAt, claimDiceBonus, setLocalDiceClaimedAt } from "../../utils/tasksApi";
import * as ImagePicker from "expo-image-picker";
import diceAnim from "../../assets/animations/dice.json";
import peacockAnim from "../../assets/animations/Peacock The Beauty of Nature.json";
import dragonAnim from "../../assets/animations/Dragon.json";
import spaceAnim from "../../assets/animations/space.json";
import loveAnim from "../../assets/animations/Love.json";
import birdAnim from "../../assets/animations/Bird pair love and flying sky.json";
import ghostAnim from "../../assets/animations/Ghost emoji animation.json";
import roseAnim from "../../assets/animations/rose.json";
import flowerAnim from "../../assets/animations/floer.json";
import surpriseGiftAnim from "../../assets/animations/Surprise in a gift box.json";
import { useLanguage } from "../_contexts/LanguageContext";

type CurrentUser = {
  id?: string;
  name?: string;
  profileImage?: string;
};

type Props = {
  me: CurrentUser | null;
  other: UserSearchResult;
  onBack: () => void;
  onOpenMyProfile?: () => void;
  onOpenOtherProfile?: () => void;
  onOpenTopup?: () => void;
  onWalletUpdate?: () => void;
};

const BG = "#141028";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const INPUT_BG = "rgba(255,255,255,0.04)";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.64;
const MAX_VOICE_SEC = 30;

// صفوف الإيموجي الظاهرة في لوحة الإيموجي
// ✌️ حجر-ورقة-مقص | 🎲 نرد
const EMOJI_ROWS: string[][] = [
  ["😘", "🤣", "🌹", "✌️", "🙂", "😂"],
  ["😊", "🥲", "🥰", "😉", "😁", "😄"],
  ["😅", "😆", "😎", "🙂", "😃", "🎲"],
  ["😜", "🤪", "😛", "🤑", "😶", "😐"],
  ["🙄", "😑", "😬", "🤫", "🤐", "😯"],
  ["😮", "😲", "😳", "🥺", "😦", "😧"],
  ["😢", "😭", "😤", "😠", "😡", "🤬"],
  ["🤢", "🤮", "🤧", "🥵", "🥶", "😵"],
  ["😵‍💫", "🤯", "😶‍🌫️", "🥱", "😴", "🤤"],
  ["😷", "🤒", "🤕", "🤑", "😈", "👿"],
  ["😪", "😌", "😔", "😞", "😟", "😕"],
  ["🙁", "☹️", "😣", "😖", "😫", "😩"],
  ["🥺", "😢", "😭", "😤", "😠", "😡"],
  ["🤠", "🥳", "😎", "🤓", "🧐", "😕"],
  ["😮", "😯", "😲", "😳", "🥸", "😏"],
  ["😶", "😐", "😑", "😬", "🙄", "😬"],
];

function parseDiceFromText(text: string | null | undefined): { isDice: boolean; value: number | null } {
  if (!text) return { isDice: false, value: null };
  if (!text.startsWith("🎲")) return { isDice: false, value: null };
  const match = text.match(/(\d+)/);
  if (!match) return { isDice: false, value: null };
  const num = parseInt(match[1], 10);
  if (!Number.isFinite(num) || num < 1 || num > 6) return { isDice: false, value: null };
  return { isDice: true, value: num };
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseGiftFromText(
  text: string | null | undefined
): { isGift: boolean; giftType: string | null; amount: number | null } {
  if (!text) return { isGift: false, giftType: null, amount: null };
  const match = text.match(/^GIFT:([^:]+):(\d+)/);
  if (!match) return { isGift: false, giftType: null, amount: null };
  const amount = parseInt(match[2], 10);
  if (!Number.isFinite(amount) || amount <= 0) return { isGift: false, giftType: null, amount: null };
  return { isGift: true, giftType: match[1], amount };
}

function mapServerToLocal(m: ChatMessage) {
  const { isDice, value } = parseDiceFromText(m.text);
  const { isGift, giftType, amount } = parseGiftFromText(m.text);
  return {
    ...m,
    status: "sent" as const,
    specialType: isDice ? "dice" : isGift ? "gift" : undefined,
    specialAnimating: false,
    diceValue: isDice ? value : null,
    giftType: isGift ? giftType : null,
    giftAmount: isGift ? amount : null,
  };
}

const GIFT_ITEMS: { image: number; name: string; cost: string }[] = [
  { image: require("../../assets/images/taws.jpg"), name: "طاوس", cost: "500" },
  { image: require("../../assets/images/tenen.jpg"), name: "تنين وردي", cost: "100" },
  { image: require("../../assets/images/spec.jpj.png"), name: "رجل فضاء", cost: "25" },
  { image: require("../../assets/images/love.jpg"), name: "رسالة حب", cost: "10" },
  { image: require("../../assets/images/perd.jpg"), name: "طيور حب", cost: "45" },
  { image: require("../../assets/images/chost.jpg"), name: "شبح", cost: "5" },
  { image: require("../../assets/images/تنزيل.png"), name: "وردة", cost: "1" },
  { image: require("../../assets/images/flo.jpg"), name: "زهرة كرز", cost: "200" },
];

const GiftGridItem = React.memo(function GiftGridItem({
  item,
  selected,
  index,
  onSelect,
  giftItemStyle,
  giftItemSelectedStyle,
  giftItemImageStyle,
  giftItemNameStyle,
  giftItemCostRowStyle,
  giftItemCostStyle,
  goldCoinIconStyle,
}: {
  item: (typeof GIFT_ITEMS)[0];
  selected: boolean;
  index: number;
  onSelect: (i: number) => void;
  giftItemStyle: object;
  giftItemSelectedStyle: object;
  giftItemImageStyle: object;
  giftItemNameStyle: object;
  giftItemCostRowStyle: object;
  giftItemCostStyle: object;
  goldCoinIconStyle: object;
}) {
  return (
    <TouchableOpacity
      style={[giftItemStyle, selected && giftItemSelectedStyle]}
      onPress={() => onSelect(index)}
      activeOpacity={0.7}
    >
      <Image source={item.image} style={giftItemImageStyle} resizeMode="cover" />
      <Text style={giftItemNameStyle} numberOfLines={1}>{item.name}</Text>
      <View style={giftItemCostRowStyle}>
        <Text style={giftItemCostStyle}>{item.cost}</Text>
        <Text style={goldCoinIconStyle}>🪙</Text>
      </View>
    </TouchableOpacity>
  );
});

export default function ChatScreen({ me, other, onBack, onOpenMyProfile, onOpenOtherProfile, onOpenTopup, onWalletUpdate }: Props) {
  const { t } = useLanguage();
  type LocalStatus = "sending" | "sent" | "failed";

  const diceFaceForValue = (value: number | null | undefined) => {
    switch (value) {
      case 1:
        return require("../../assets/animations/h.jpd.png");
      case 2:
        return require("../../assets/animations/pngtree-set-of-6-cube-dice-with-six-different-dots-number-vector-png-image_9267866 (1).png");
      case 3:
        return require("../../assets/animations/pngtree-set-of-6-cube-dice-with-six-different-dots-number-vector-png-image_9267866 (2).png");
      case 4:
        return require("../../assets/animations/pngtree-set-of-6-cube-dice-with-six-different-dots-number-vector-png-image_9267866 (3).png");
      case 5:
        return require("../../assets/animations/pngtree-set-of-6-cube-dice-with-six-different-dots-number-vector-png-image_9267866 (4).png");
      case 6:
      default:
        return require("../../assets/animations/pngtree-set-of-6-cube-dice-with-six-different-dots-number-vector-png-image_9267866.png");
    }
  };

  type LocalChatMessage = ChatMessage & {
    status?: LocalStatus;
    replyToText?: string | null;
    specialType?: "dice" | "rps" | "gift";
    specialAnimating?: boolean;
    diceValue?: number | null;
    localImageUri?: string | null;
    giftType?: string | null;
    giftAmount?: number | null;
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
  const [recentEmojis, setRecentEmojis] = useState<string[]>(["😘", "🤣", "🌹", "✌️", "🙂", "😂"]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [goldBalance, setGoldBalance] = useState<number>(0);
  const [chargedGold, setChargedGold] = useState<number>(0);
  const [freeGold, setFreeGold] = useState<number>(0);
  const [bonusModal, setBonusModal] = useState<{ reward: number } | null>(null);
  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] = useState(false);
  const [selectedGiftIndex, setSelectedGiftIndex] = useState<number | null>(null);
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [showGiftOverlay, setShowGiftOverlay] = useState(false);
  const [giftOverlayType, setGiftOverlayType] = useState<"peacock" | "dragon" | "space" | "love" | "bird" | "ghost" | "rose" | "flower" | null>(null);
  const [quickGiftVisible, setQuickGiftVisible] = useState(false);
  const [quickGiftCount, setQuickGiftCount] = useState(1);
  const quickGiftKeyRef = useRef<"peacock" | "dragon" | "space" | "love" | "bird" | "ghost" | "rose" | "flower" | null>(null);
  const quickGiftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickGiftProgress = useRef(new Animated.Value(0)).current;

  const addToRecent = useCallback((emoji: string) => {
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 8);
      return next;
    });
  }, []);
  const scrollRef = useRef<ScrollView | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startQuickGiftCountdown = useCallback(
    (giftKey: "peacock" | "dragon" | "space" | "love" | "bird" | "ghost" | "rose" | "flower") => {
      quickGiftKeyRef.current = giftKey;
      setQuickGiftVisible(true);
      quickGiftProgress.setValue(0);
      if (quickGiftTimerRef.current) {
        clearTimeout(quickGiftTimerRef.current);
      }
      Animated.timing(quickGiftProgress, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
        easing: Easing.linear,
      }).start();
      quickGiftTimerRef.current = setTimeout(() => {
        setQuickGiftVisible(false);
        quickGiftKeyRef.current = null;
      }, 10000);
    },
    [quickGiftProgress]
  );

  const dedupeById = useCallback(<T extends { id: string }>(arr: T[]): T[] => {
    const seen = new Set<string>();
    return arr.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCachedThread(other.id).then((cached) => {
      if (cancelled) return;
      if (cached.length > 0) setMessages(dedupeById(cached.map((m) => mapServerToLocal(m))));
    });
    fetchThread(other.id).then((list) => {
      if (cancelled) return;
      setMessages(dedupeById(list.map((m) => mapServerToLocal(m))));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    });
    return () => {
      cancelled = true;
    };
  }, [other.id, dedupeById]);

  // استعلام دوري للرسائل الجديدة — كل 1.5 ثانية
  const POLL_INTERVAL_MS = 1500;
  useEffect(() => {
    const interval = setInterval(() => {
      fetchThread(other.id).then((list) => {
        setMessages((prev) => {
          const fromServer = dedupeById(list.map((m) => mapServerToLocal(m)));
          const serverKeys = new Set(fromServer.map((m) => `${m.fromId}:${m.toId}:${m.text}:${m.createdAt?.slice(0, 19)}`));
          const sending = prev.filter((m) => {
            if (m.status !== "sending") return false;
            const key = `${m.fromId}:${m.toId}:${m.text}:${m.createdAt?.slice(0, 19)}`;
            return !serverKeys.has(key);
          });
          const merged = dedupeById([...fromServer, ...sending]);
          merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          return merged;
        });
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [other.id, dedupeById]);

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
      const result = await sendMessage(other.id, "🎤 رسالة صوتية", null, up.audioUrl, durationSec, null, null, buildSenderForNotification(me));
      if (result) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimistic.id ? { ...result.message, status: "sent" } : m
          )
        );
        if (result.bonusTask || result.justReachedFive || result.justReachedFiveDice) {
          if (result.bonusTask) {
            setBonusModal({ reward: result.bonusTask.reward });
            setLocalClaimedAt(Date.now());
            onWalletUpdate?.();
          } else if (result.justReachedFiveDice) {
            await setLocalDiceClaimedAt(Date.now());
            setBonusModal({ reward: 8 });
            claimDiceBonus().then(() => onWalletUpdate?.());
          } else {
            await setLocalClaimedAt(Date.now());
            setBonusModal({ reward: 15 });
            claimFiveMessagesBonus().then(() => onWalletUpdate?.());
          }
        }
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
      replyToFromId: replyTo?.fromId ?? null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);
    setText("");
    setReplyTo(null);
    setActiveMenuId(null);
    const result = await sendMessage(
      other.id,
      optimistic.text,
      optimistic.replyToText ?? null,
      null,
      null,
      null,
      optimistic.replyToFromId ?? null,
      buildSenderForNotification(me)
    );
    const emojiMatch = trimmed.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}]/gu);
    if (emojiMatch?.length) emojiMatch.forEach((e) => addToRecent(e));
    if (result) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...result.message, status: "sent", replyToText: optimistic.replyToText ?? null } : m
        )
      );
      if (result.bonusTask || result.justReachedFive || result.justReachedFiveDice) {
        if (result.bonusTask) {
          setBonusModal({ reward: result.bonusTask.reward });
          setLocalClaimedAt(Date.now());
          onWalletUpdate?.();
        } else if (result.justReachedFiveDice) {
          await setLocalDiceClaimedAt(Date.now());
          setBonusModal({ reward: 8 });
          claimDiceBonus().then(() => onWalletUpdate?.());
        } else {
          await setLocalClaimedAt(Date.now());
          setBonusModal({ reward: 15 });
          claimFiveMessagesBonus().then(() => onWalletUpdate?.());
        }
      }
    } else {
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...m, status: "failed" } : m)));
    }
  };

  const retrySend = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status: "sending" } : m)));
    let imageUrl = msg.imageUrl ?? null;

    // في حالة رسالة صورة بدون رابط سيرفر (فشل الرفع في المحاولة الأولى) نعيد الرفع
    if (!imageUrl && msg.localImageUri) {
      const uploaded = await uploadImageMessage(msg.localImageUri);
      if (!uploaded) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status: "failed" } : m)));
        return;
      }
      imageUrl = uploaded.imageUrl;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, imageUrl, localImageUri: m.localImageUri ?? null } : m))
      );
    }

    const { amount: giftAmt } = parseGiftFromText(msg.text);
    const result = await sendMessage(
      other.id,
      msg.text,
      msg.replyToText ?? null,
      msg.audioUrl ?? null,
      msg.audioDurationSeconds ?? null,
      imageUrl,
      msg.replyToFromId ?? null,
      buildSenderForNotification(me),
      giftAmt ?? undefined
    );
    if (result) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...result.message, status: "sent" } : m)));
      if (result.bonusTask || result.justReachedFive || result.justReachedFiveDice) {
        if (result.bonusTask) {
          setBonusModal({ reward: result.bonusTask.reward });
          setLocalClaimedAt(Date.now());
          onWalletUpdate?.();
        } else if (result.justReachedFiveDice) {
          await setLocalDiceClaimedAt(Date.now());
          setBonusModal({ reward: 8 });
          claimDiceBonus().then(() => onWalletUpdate?.());
        } else {
          await setLocalClaimedAt(Date.now());
          setBonusModal({ reward: 15 });
          claimFiveMessagesBonus().then(() => onWalletUpdate?.());
        }
      }
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

  const handleOpenGiftModal = useCallback(() => {
    setShowEmojiPicker(false);
    if (showGiftModal) {
      setShowGiftModal(false);
      return;
    }
    setSelectedGiftIndex(0);
    setGiftQuantity(1);
    setShowGiftModal(true);
    fetchWallet().then((w) => {
      const total = (w?.totalGold ?? 0);
      const charged = w?.chargedGold ?? 0;
      const free = w?.freeGold ?? 0;
      setGoldBalance(total);
      setChargedGold(charged);
      setFreeGold(free);
    });
  }, [showGiftModal]);

  const handleCloseGiftModal = useCallback(() => {
    setShowGiftModal(false);
    setShowEmojiPicker(false);
  }, []);

  const handleSendGift = useCallback(() => {
    if (!me?.id || selectedGiftIndex === null) {
      handleCloseGiftModal();
      return;
    }
    let giftKey: "peacock" | "dragon" | "space" | "love" | "bird" | "ghost" | "rose" | "flower";
    if (selectedGiftIndex === 0) giftKey = "peacock";
    else if (selectedGiftIndex === 1) giftKey = "dragon";
    else if (selectedGiftIndex === 2) giftKey = "space";
    else if (selectedGiftIndex === 3) giftKey = "love";
    else if (selectedGiftIndex === 4) giftKey = "bird";
    else if (selectedGiftIndex === 5) giftKey = "ghost";
    else if (selectedGiftIndex === 6) giftKey = "rose";
    else giftKey = "flower";

    const baseAmount =
      giftKey === "peacock"
        ? 500
        : giftKey === "dragon"
        ? 100
        : giftKey === "space"
        ? 25
        : giftKey === "love"
        ? 10
        : giftKey === "bird"
        ? 45
        : giftKey === "ghost"
        ? 5
        : giftKey === "rose"
        ? 1
        : 200;
    const amount = baseAmount * Math.max(1, giftQuantity);

    if (goldBalance <= 0 || goldBalance < amount) {
      setShowGiftModal(false);
      setShowInsufficientBalanceModal(true);
      return;
    }

    const text = `GIFT:${giftKey}:${amount}`;
    const id = `local-gift-${Date.now()}`;
    const optimistic: LocalChatMessage = {
      id,
      fromId: me.id,
      toId: other.id,
      text,
      createdAt: new Date().toISOString(),
      status: "sending",
      specialType: "gift",
      specialAnimating: true,
      giftType: giftKey,
      giftAmount: amount,
      replyToText: replyTo?.text ?? null,
      replyToFromId: replyTo?.fromId ?? null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);
    setShowGiftModal(false);
    const takeFromCharged = Math.min(chargedGold, amount);
    const takeFromFree = amount - takeFromCharged;
    setChargedGold((c) => Math.max(0, c - takeFromCharged));
    setFreeGold((f) => Math.max(0, f - takeFromFree));
    setGoldBalance((g) => g - amount);
    setGiftOverlayType(giftKey);
    setShowGiftOverlay(true);
    setQuickGiftCount(1);
    startQuickGiftCountdown(giftKey);

    setTimeout(() => {
      setShowGiftOverlay(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, specialAnimating: false } : m
        )
      );
      void (async () => {
        const result = await sendMessage(
          other.id,
          text,
          optimistic.replyToText ?? null,
          null,
          null,
          null,
          optimistic.replyToFromId ?? null,
          buildSenderForNotification(me),
          amount
        );
        if (result) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...result.message,
                    status: "sent",
                    specialType: "gift",
                    giftType: giftKey,
                    giftAmount: amount,
                  }
                : m
            )
          );
          if (result.bonusTask || result.justReachedFive || result.justReachedFiveDice) {
            if (result.bonusTask) {
              setBonusModal({ reward: result.bonusTask.reward });
              setLocalClaimedAt(Date.now());
              onWalletUpdate?.();
            } else if (result.justReachedFiveDice) {
              await setLocalDiceClaimedAt(Date.now());
              setBonusModal({ reward: 8 });
              claimDiceBonus().then(() => onWalletUpdate?.());
            } else {
              await setLocalClaimedAt(Date.now());
              setBonusModal({ reward: 15 });
              claimFiveMessagesBonus().then(() => onWalletUpdate?.());
            }
          }
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, status: "failed" } : m
            )
          );
        }
      })();
    }, 1800);
  }, [me?.id, other.id, giftQuantity, selectedGiftIndex, replyTo, handleCloseGiftModal, startQuickGiftCountdown, goldBalance, chargedGold]);

  const handlePickImage = useCallback(async () => {
    if (!me?.id) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled || !result.assets || !result.assets.length) return;
      const asset = result.assets[0];
      const localUri = asset.uri;
      if (!localUri) return;

      const id = `local-img-${Date.now()}`;
      const optimistic: LocalChatMessage = {
        id,
        fromId: me.id,
        toId: other.id,
        text: "📷 صورة",
        createdAt: new Date().toISOString(),
        status: "sending",
        imageUrl: localUri,
        localImageUri: localUri,
        replyToText: replyTo?.text ?? null,
        replyToFromId: replyTo?.fromId ?? null,
      };
      setMessages((prev) => [...prev, optimistic]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);

      const uploaded = await uploadImageMessage(localUri);
      if (!uploaded) {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
        return;
      }

      const sendResult = await sendMessage(other.id, optimistic.text, optimistic.replyToText ?? null, null, null, uploaded.imageUrl, optimistic.replyToFromId ?? null, buildSenderForNotification(me));
      if (sendResult) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...sendResult.message, status: "sent", imageUrl: uploaded.imageUrl, localImageUri: localUri } : m
          )
        );
        if (sendResult.bonusTask || sendResult.justReachedFive || sendResult.justReachedFiveDice) {
          if (sendResult.bonusTask) {
            setBonusModal({ reward: sendResult.bonusTask.reward });
            setLocalClaimedAt(Date.now());
            onWalletUpdate?.();
          } else if (sendResult.justReachedFiveDice) {
            await setLocalDiceClaimedAt(Date.now());
            setBonusModal({ reward: 8 });
            claimDiceBonus().then(() => onWalletUpdate?.());
          } else {
            await setLocalClaimedAt(Date.now());
            setBonusModal({ reward: 15 });
            claimFiveMessagesBonus().then(() => onWalletUpdate?.());
          }
        }
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, status: "failed", imageUrl: uploaded.imageUrl, localImageUri: localUri } : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.status === "sending" && (m.imageUrl || m.localImageUri) ? { ...m, status: "failed" as LocalStatus } : m
        )
      );
    }
  }, [me?.id, other.id, replyTo]);

  const handleSendDice = useCallback(() => {
    if (!me?.id) return;
    const id = `local-dice-${Date.now()}`;
    const optimistic: LocalChatMessage = {
      id,
      fromId: me.id,
      toId: other.id,
      text: "🎲", // النص البسيط الذي يُرسل للبك-إند
      createdAt: new Date().toISOString(),
      status: "sending",
      specialType: "dice",
      specialAnimating: true,
      diceValue: null,
      replyToText: replyTo?.text ?? null,
      replyToFromId: replyTo?.fromId ?? null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);

    // أنيميشن أرقام النرد (1-6) لمدة تقريبية ~2 ثانية
    const totalSteps = 16;
    const intervalMs = 120;
    let step = 0;

    const timer = setInterval(() => {
      step += 1;

      // خطوة دوران: إظهار رقم عشوائي
      if (step < totalSteps) {
        const tempValue = Math.floor(Math.random() * 6) + 1;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, diceValue: tempValue } : m
          )
        );
        return;
      }

      // إيقاف التايمر واختيار النتيجة النهائية
      clearInterval(timer);
      const finalValue = Math.floor(Math.random() * 6) + 1;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, diceValue: finalValue, specialAnimating: false }
            : m
        )
      );

      // إرسال النتيجة النهائية إلى الباك إند كنص (مثلاً "🎲 5")
      const finalText = `🎲 ${finalValue}`;
      void (async () => {
        const result = await sendMessage(
          other.id,
          finalText,
          optimistic.replyToText ?? null,
          null,
          null,
          null,
          optimistic.replyToFromId ?? null,
          buildSenderForNotification(me)
        );
        if (result) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...result.message, status: "sent", specialType: "dice", diceValue: finalValue } : m
            )
          );
          if (result.bonusTask || result.justReachedFive || result.justReachedFiveDice) {
            if (result.bonusTask) {
              setBonusModal({ reward: result.bonusTask.reward });
              setLocalClaimedAt(Date.now());
              onWalletUpdate?.();
            } else if (result.justReachedFiveDice) {
              await setLocalDiceClaimedAt(Date.now());
              setBonusModal({ reward: 8 });
              claimDiceBonus().then(() => onWalletUpdate?.());
            } else {
              await setLocalClaimedAt(Date.now());
              setBonusModal({ reward: 15 });
              claimFiveMessagesBonus().then(() => onWalletUpdate?.());
            }
          }
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, status: "failed" } : m
            )
          );
        }
      })();
    }, intervalMs);
  }, [me?.id, other.id, replyTo]);

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
      replyToText: replyTo?.text ?? null,
      replyToFromId: replyTo?.fromId ?? null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);

    const totalSteps = 20;
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
        setTimeout(() => spin(step + 1), 55);
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
          const result = await sendMessage(
            other.id,
            final,
            optimistic.replyToText ?? null,
            null,
            null,
            null,
            optimistic.replyToFromId ?? null,
            buildSenderForNotification(me)
          );
          if (result) {
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...result.message, status: "sent" } : m))
            );
            if (result.bonusTask || result.justReachedFive) {
              if (result.bonusTask) {
                setBonusModal({ reward: result.bonusTask.reward });
                setLocalClaimedAt(Date.now());
                onWalletUpdate?.();
              } else {
                await setLocalClaimedAt(Date.now());
                setBonusModal({ reward: 15 });
                claimFiveMessagesBonus().then(() => onWalletUpdate?.());
              }
            }
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
  }, [me?.id, other.id, replyTo]);

  const handlePickEmoji = (emoji: string) => {
    if (emoji === "🎲") {
      addToRecent("🎲");
      setShowEmojiPicker(false);
      void handleSendDice();
      return;
    }
    if (emoji === "✌️") {
      addToRecent("✌️");
      setShowEmojiPicker(false);
      void handleSendRps();
      return;
    }
    addToRecent(emoji);
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
      if (quickGiftTimerRef.current) {
        clearTimeout(quickGiftTimerRef.current);
      }
    };
  }, []);

  const renderBubbleContent = (m: LocalChatMessage, isMine: boolean, status: LocalStatus) => {
    const isVoice = !!m.audioUrl;
    const dur = m.audioDurationSeconds ?? 0;
    const isDice = m.specialType === "dice";
    const isGift =
      m.specialType === "gift" ||
      /^GIFT:/.test(m.text || "");
    const isRps =
      m.specialType === "rps" ||
      /[✊✋✌️]/.test(m.text || "");

    if (isDice) {
      return (
        <View style={styles.specialBubbleCenter}>
          {m.specialAnimating && (
            <LottieView
              source={diceAnim}
              autoPlay
              loop
              style={styles.diceLottie}
            />
          )}
          {!m.specialAnimating && (
            <Image
              source={diceFaceForValue(m.diceValue ?? null)}
              style={styles.diceImage}
              resizeMode="contain"
            />
          )}
        </View>
      );
    }

    if (isRps) {
      return (
        <View style={styles.specialBubbleCenter}>
          <Text style={styles.rpsEmoji}>{m.text}</Text>
        </View>
      );
    }

    if (isGift) {
      const amount = m.giftAmount ?? 0;
      const baseAmount =
        m.giftType === "peacock"
          ? 500
          : m.giftType === "dragon"
          ? 100
          : m.giftType === "space"
          ? 25
          : m.giftType === "love"
          ? 10
          : m.giftType === "bird"
          ? 45
          : m.giftType === "ghost"
          ? 5
          : m.giftType === "rose"
          ? 1
          : 200;
      const qty = Math.max(1, Math.round(amount / (baseAmount || 1)) || 1);
      const otherName = other.name || other.id;
      const titleText = isMine
        ? (otherName ? `إرسال «${otherName}»` : "إرسال")
        : (otherName ? `«${otherName}» أرسل لك` : "أرسل لك");
      return (
        <View style={styles.giftCardBubble}>
          <Image
            source={
              m.giftType === "dragon"
                ? require("../../assets/images/tenen.jpg")
                : m.giftType === "space"
                ? require("../../assets/images/spec.jpj.png")
                : m.giftType === "love"
                ? require("../../assets/images/love.jpg")
                : m.giftType === "bird"
                ? require("../../assets/images/perd.jpg")
                : m.giftType === "ghost"
                ? require("../../assets/images/chost.jpg")
                : m.giftType === "rose"
                ? require("../../assets/images/تنزيل.png")
                : m.giftType === "flower"
                ? require("../../assets/images/flo.jpg")
                : require("../../assets/images/taws.jpg")
            }
            style={styles.giftCardImage}
            resizeMode="cover"
          />
          <View style={styles.giftCardContent}>
            <Text style={styles.giftCardTitle}>{titleText}</Text>
            <Text style={styles.giftCardSubtitle}>
              {m.giftType === "dragon"
                ? "تنين وردي"
                : m.giftType === "space"
                ? "رجل فضاء"
                : m.giftType === "love"
                ? "رسالة حب"
                : m.giftType === "bird"
                ? "طيور حب"
                : m.giftType === "ghost"
                ? "شبح"
                : m.giftType === "rose"
                ? "وردة"
                : m.giftType === "flower"
                ? "زهرة كرز"
                : "طاوس"}{" "}
              x{qty}
            </Text>
            <View style={styles.giftCardBottomRow}>
              <TouchableOpacity
                style={styles.giftPlayBtn}
                activeOpacity={0.5}
                onPress={() => {
                  setGiftOverlayType(
                    m.giftType === "dragon"
                      ? "dragon"
                      : m.giftType === "space"
                      ? "space"
                      : m.giftType === "love"
                      ? "love"
                      : m.giftType === "bird"
                      ? "bird"
                      : m.giftType === "ghost"
                      ? "ghost"
                      : m.giftType === "rose"
                      ? "rose"
                      : m.giftType === "flower"
                      ? "flower"
                      : "peacock"
                  );
                  setShowGiftOverlay(true);
                }}
              >
                <Ionicons name="play-circle" size={18} color="#a855f7" />
              </TouchableOpacity>
              <View style={styles.giftCardGoldRow}>
                <Text style={styles.goldCoinIcon}>🪙</Text>
                <Text style={styles.giftCardGoldText}>{amount}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (isVoice) {
      const loading = loadingVoiceId === m.id;
      return (
        <View style={styles.voiceRow}>
          <TouchableOpacity
            style={styles.voicePlayBtn}
            onPress={() => handlePlayVoice(m)}
            activeOpacity={0.5}
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
    const isImage = !!m.imageUrl || !!m.localImageUri;
    if (isImage) {
      const uri = (m.imageUrl || m.localImageUri) as string;
      return (
        <>
          <TouchableOpacity activeOpacity={0.5} onPress={() => setPreviewImage(uri)}>
            <Image source={{ uri }} style={styles.imageBubble} resizeMode="cover" />
          </TouchableOpacity>
          {isMine && status === "failed" && (
            <TouchableOpacity activeOpacity={0.5} onPress={() => retrySend(m.id)} style={styles.failedRow}>
              <Ionicons name="alert-circle" size={14} color="#f87171" />
              <Text style={styles.failedText}>{t("chat.sendFailed")}</Text>
            </TouchableOpacity>
          )}
        </>
      );
    }
    return (
      <>
        <Text style={isMine ? styles.myMsgText : styles.otherMsgText}>{m.text}</Text>
        {isMine && status === "failed" && (
          <TouchableOpacity activeOpacity={0.5} onPress={() => retrySend(m.id)} style={styles.failedRow}>
            <Ionicons name="alert-circle" size={14} color="#f87171" />
            <Text style={styles.failedText}>{t("chat.sendFailed")}</Text>
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
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.5}>
            <Ionicons name="arrow-back" size={22} color={TEXT_LIGHT} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.avatarsRow}>
              <TouchableOpacity onPress={onOpenMyProfile} activeOpacity={0.5} disabled={!onOpenMyProfile}>
                {me?.profileImage ? (
                  <Image source={{ uri: me.profileImage }} style={styles.headerAvatarSmall} />
                ) : (
                  <View style={[styles.headerAvatarSmall, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={18} color={TEXT_MUTED} />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={onOpenOtherProfile} activeOpacity={0.5} disabled={!onOpenOtherProfile}>
                {other.profileImage ? (
                  <Image source={{ uri: other.profileImage }} style={styles.headerAvatarSmall} />
                ) : (
                  <View style={[styles.headerAvatarSmall, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={18} color={TEXT_MUTED} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.otherName} numberOfLines={1}>{other.name}</Text>
            <Text style={styles.otherId}>{other.id}</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.messagesContainer} ref={scrollRef} keyboardShouldPersistTaps="handled" scrollEventThrottle={16}>
          {dedupeById(messages).map((m) => {
            const isMine = m.fromId === me?.id;
            const status: LocalStatus = m.status || "sent";
            const isDice =
              m.specialType === "dice" ||
              /^🎲/.test(m.text || "");
            const isRps =
              m.specialType === "rps" ||
              /[✊✋✌️]/.test(m.text || "");
            const isGift =
              m.specialType === "gift" ||
              /^GIFT:/.test(m.text || "");
            const replyName =
              m.replyToFromId && m.replyToFromId !== m.fromId
                ? m.replyToFromId === other.id
                  ? other.name
                  : me?.name || "أنت"
                : "";
            return (
              <View key={m.id} style={isMine ? styles.myMsgRow : styles.otherMsgRow}>
                {!isMine && (
                  <TouchableOpacity onPress={onOpenOtherProfile} activeOpacity={0.5} disabled={!onOpenOtherProfile}>
                    {other.profileImage ? (
                      <Image source={{ uri: other.profileImage }} style={styles.msgAvatarOther} />
                    ) : (
                      <View style={[styles.msgAvatarOther, styles.avatarPlaceholder]}>
                        <Ionicons name="person" size={18} color={TEXT_MUTED} />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                    <View style={isMine ? styles.myMsgSideMine : styles.myMsgSideOther}>
                  <TouchableOpacity
                    activeOpacity={0.5}
                    onLongPress={() => setActiveMenuId(m.id)}
                    delayLongPress={200}
                  >
                    {isDice || isRps || isGift ? (
                      <View style={styles.specialStandalone}>
                        {!!m.replyToText && (
                          <View style={styles.replyPreviewInBubble}>
                            {replyName ? (
                              <Text style={styles.replyPreviewName}>: {replyName}</Text>
                            ) : null}
                            <Text style={styles.replyPreviewText}>{m.replyToText}</Text>
                          </View>
                        )}
                        {renderBubbleContent(m, isMine, status)}
                      </View>
                    ) : (
                      <View style={isMine ? styles.myMsgBubble : styles.otherMsgBubble}>
                        {!!m.replyToText && (
                          <View style={styles.replyPreviewInBubble}>
                            {replyName ? (
                              <Text style={styles.replyPreviewName}>: {replyName}</Text>
                            ) : null}
                            <Text style={styles.replyPreviewText}>{m.replyToText}</Text>
                          </View>
                        )}
                        {renderBubbleContent(m, isMine, status)}
                      </View>
                    )}
                  </TouchableOpacity>
                  {activeMenuId === m.id && (
                    <View style={styles.messageMenu}>
                      <TouchableOpacity
                        activeOpacity={0.5}
                        style={styles.menuBtn}
                        onPress={() => { setReplyTo(m); setActiveMenuId(null); }}
                      >
                        <Text style={styles.menuBtnText}>رد</Text>
                      </TouchableOpacity>
                      {isMine && (
                        <TouchableOpacity activeOpacity={0.5} style={styles.menuBtn} onPress={() => handleDelete(m.id)}>
                          <Text style={styles.menuBtnText}>سحب</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
                {isMine && (
                  <TouchableOpacity onPress={onOpenMyProfile} activeOpacity={0.5} disabled={!onOpenMyProfile}>
                    {me?.profileImage ? (
                      <Image source={{ uri: me.profileImage }} style={styles.msgAvatarMine} />
                    ) : (
                      <View style={[styles.msgAvatarMine, styles.avatarPlaceholder]}>
                        <Ionicons name="person" size={18} color={TEXT_MUTED} />
                      </View>
                    )}
                  </TouchableOpacity>
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
              placeholder={t("chat.typeMessage")}
              placeholderTextColor={TEXT_MUTED}
              multiline
              value={text}
              onChangeText={setText}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              onFocus={() => setShowEmojiPicker(false)}
            />
            <TouchableOpacity onPress={handleSend} disabled={!text.trim()} activeOpacity={0.5}>
              <Ionicons name="send" size={22} color={text.trim() ? "#4ade80" : TEXT_MUTED} />
            </TouchableOpacity>
          </View>

          {showEmojiPicker && (
            <View style={styles.emojiPanel}>
              <View style={styles.emojiSection}>
                <Text style={styles.emojiSectionLabel}>{t("chat.recent")}</Text>
                <View style={styles.emojiRow}>
                  {recentEmojis.map((emoji, i) => (
                    <TouchableOpacity
                      key={`recent-${i}-${emoji}`}
                      style={styles.emojiBtn}
                      activeOpacity={0.5}
                      onPress={() => handlePickEmoji(emoji)}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.emojiSection}>
                <Text style={styles.emojiSectionLabel}>{t("chat.all")}</Text>
                <ScrollView style={styles.emojiScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {EMOJI_ROWS.map((row, idx) => (
                    <View key={idx} style={styles.emojiRow}>
                      {row.map((emoji, colIdx) => (
                        <TouchableOpacity
                          key={`${idx}-${colIdx}`}
                          style={styles.emojiBtn}
                          activeOpacity={0.5}
                          onPress={() => handlePickEmoji(emoji)}
                        >
                          <Text style={styles.emojiText}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.emojiActions}>
                <TouchableOpacity
                  style={[styles.emojiActionBtn, !text.trim() && styles.emojiActionBtnDisabled]}
                  onPress={() => text.trim() && handleSend()}
                  activeOpacity={0.5}
                  disabled={!text.trim()}
                >
                  <Ionicons name="send" size={20} color={text.trim() ? "#4ade80" : TEXT_MUTED} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.emojiActionBtn}
                  onPress={() => setText((prev) => prev.slice(0, -1))}
                  activeOpacity={0.5}
                >
                  <Ionicons name="backspace-outline" size={20} color={TEXT_LIGHT} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.bottomActions}>
            <View style={styles.leftActions}>
              <TouchableOpacity
                onPress={handleStartVoice}
                activeOpacity={0.5}
                disabled={isRecording}
              >
                {isRecording ? (
                  <ActivityIndicator size="small" color="#f87171" />
                ) : (
                  <Ionicons name="mic" size={22} color="#60a5fa" />
                )}
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.5} onPress={handleToggleEmoji}>
                <Ionicons name="happy-outline" size={22} color={TEXT_MUTED} />
              </TouchableOpacity>
            </View>
            <View style={styles.rightActions}>
              <TouchableOpacity activeOpacity={0.5} onPress={handlePickImage}>
                <Ionicons name="image-outline" size={22} color={TEXT_MUTED} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.5} onPress={handleOpenGiftModal}>
                <LottieView source={surpriseGiftAnim} autoPlay loop style={styles.giftIconAnim} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {previewImage && (
          <Modal visible transparent onRequestClose={() => setPreviewImage(null)}>
            <TouchableOpacity style={styles.previewBackdrop} activeOpacity={1} onPress={() => setPreviewImage(null)}>
              <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
            </TouchableOpacity>
          </Modal>
        )}
        {showGiftOverlay && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setShowGiftOverlay(false)}>
            <View style={styles.giftOverlay}>
              <LottieView
                source={
                  giftOverlayType === "dragon"
                    ? dragonAnim
                    : giftOverlayType === "space"
                    ? spaceAnim
                    : giftOverlayType === "love"
                    ? loveAnim
                    : giftOverlayType === "bird"
                    ? birdAnim
                    : giftOverlayType === "ghost"
                    ? ghostAnim
                    : giftOverlayType === "rose"
                    ? roseAnim
                    : giftOverlayType === "flower"
                    ? flowerAnim
                    : peacockAnim
                }
                autoPlay
                loop={false}
                style={styles.giftOverlayLottie}
                onAnimationFinish={() => {
                  setShowGiftOverlay(false);
                  setGiftOverlayType(null);
                }}
              />
            </View>
          </Modal>
        )}
        {quickGiftVisible && quickGiftKeyRef.current && (
          <View style={styles.quickGiftContainer}>
            <TouchableOpacity
              activeOpacity={0.5}
              onPress={() => {
                const key = quickGiftKeyRef.current;
                if (!me?.id || !key) return;
                const baseAmount =
                  key === "peacock"
                    ? 500
                    : key === "dragon"
                    ? 100
                    : key === "space"
                    ? 25
                    : key === "love"
                    ? 10
                    : key === "bird"
                    ? 45
                    : key === "ghost"
                    ? 5
                    : key === "rose"
                    ? 1
                    : 200;
                const amount = baseAmount;
                if (goldBalance <= 0 || goldBalance < amount) {
                  setShowInsufficientBalanceModal(true);
                  return;
                }
                const text = `GIFT:${key}:${amount}`;
                const id = `local-quick-gift-${Date.now()}`;
                const optimistic: LocalChatMessage = {
                  id,
                  fromId: me.id,
                  toId: other.id,
                  text,
                  createdAt: new Date().toISOString(),
                  status: "sending",
                  specialType: "gift",
                  specialAnimating: true,
                  giftType: key,
                  giftAmount: amount,
                  replyToText: replyTo?.text ?? null,
                  replyToFromId: replyTo?.fromId ?? null,
                };
                setMessages((prev) => [...prev, optimistic]);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);
                const takeFromCharged = Math.min(chargedGold, amount);
                const takeFromFree = amount - takeFromCharged;
                setChargedGold((c) => Math.max(0, c - takeFromCharged));
                setFreeGold((f) => Math.max(0, f - takeFromFree));
                setGoldBalance((g) => g - amount);
                setGiftOverlayType(key);
                setShowGiftOverlay(true);
                setQuickGiftCount((c) => c + 1);
                startQuickGiftCountdown(key);
                void (async () => {
                  const result = await sendMessage(
                    other.id,
                    text,
                    optimistic.replyToText ?? null,
                    null,
                    null,
                    null,
                    optimistic.replyToFromId ?? null,
                    buildSenderForNotification(me),
                    amount
                  );
                  if (result) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === id
                          ? {
                              ...result.message,
                              status: "sent",
                              specialType: "gift",
                              giftType: key,
                              giftAmount: amount,
                            }
                          : m
                      )
                    );
                    if (result.bonusTask || result.justReachedFive || result.justReachedFiveDice) {
                      if (result.bonusTask) {
                        setBonusModal({ reward: result.bonusTask.reward });
                        setLocalClaimedAt(Date.now());
                        onWalletUpdate?.();
                      } else if (result.justReachedFiveDice) {
                        await setLocalDiceClaimedAt(Date.now());
                        setBonusModal({ reward: 8 });
                        claimDiceBonus().then(() => onWalletUpdate?.());
                      } else {
                        await setLocalClaimedAt(Date.now());
                        setBonusModal({ reward: 15 });
                        claimFiveMessagesBonus().then(() => onWalletUpdate?.());
                      }
                    }
                  } else {
                    setMessages((prev) =>
                      prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m))
                    );
                  }
                })();
              }}
            >
              <View style={styles.quickGiftCircle}>
                <Animated.View
                  style={[
                    styles.quickGiftRing,
                    {
                      transform: [
                        {
                          rotateZ: quickGiftProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0deg", "360deg"],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.quickGiftTick} />
                </Animated.View>
                {(() => {
                  const key = quickGiftKeyRef.current;
                  if (key === "dragon") {
                    return (
                      <Image
                        source={require("../../assets/images/tenen.jpg")}
                        style={styles.giftCardImage}
                        resizeMode="cover"
                      />
                    );
                  }
                  if (key === "space") {
                    return (
                      <Image
                        source={require("../../assets/images/spec.jpj.png")}
                        style={styles.giftCardImage}
                        resizeMode="cover"
                      />
                    );
                  }
                  if (key === "love") {
                    return (
                      <Image
                        source={require("../../assets/images/love.jpg")}
                        style={styles.giftCardImage}
                        resizeMode="cover"
                      />
                    );
                  }
                  if (key === "bird") {
                    return (
                      <Image
                        source={require("../../assets/images/perd.jpg")}
                        style={styles.giftCardImage}
                        resizeMode="cover"
                      />
                    );
                  }
                  if (key === "ghost") {
                    return (
                      <Image
                        source={require("../../assets/images/chost.jpg")}
                        style={styles.giftCardImage}
                        resizeMode="cover"
                      />
                    );
                  }
                  if (key === "rose") {
                    return (
                      <Image
                        source={require("../../assets/images/تنزيل.png")}
                        style={styles.giftCardImage}
                        resizeMode="cover"
                      />
                    );
                  }
                  if (key === "flower") {
                    return (
                      <Image
                        source={require("../../assets/images/flo.jpg")}
                        style={styles.giftCardImage}
                        resizeMode="cover"
                      />
                    );
                  }
                  return (
                    <Image
                      source={require("../../assets/images/taws.jpg")}
                      style={styles.giftCardImage}
                      resizeMode="cover"
                    />
                  );
                })()}
                <Text style={styles.quickGiftCount}>{quickGiftCount}</Text>
                <Text style={styles.quickGiftText}>{t("chat.send")}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        {showInsufficientBalanceModal && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setShowInsufficientBalanceModal(false)}>
            <View style={styles.insufficientModalOverlay}>
              <View style={styles.insufficientModalCard}>
                <View style={styles.insufficientModalIconWrap}>
                  <Text style={styles.insufficientModalIcon}>🪙</Text>
                </View>
                <Text style={styles.insufficientModalTitle}>{t("chat.insufficientBalance")}</Text>
                <Text style={styles.insufficientModalSubtitle}>{t("chat.needMoreGold")}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowInsufficientBalanceModal(false);
                    onOpenTopup?.();
                  }}
                  activeOpacity={0.5}
                  style={styles.insufficientModalBtnWrap}
                >
                  <LinearGradient
                    colors={["#7c3aed", "#a855f7", "#c084fc"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.insufficientModalBtn}
                  >
                    <Ionicons name="card" size={20} color="#fff" />
                    <Text style={styles.insufficientModalBtnText}>{t("chat.goToTopup")}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.insufficientModalCloseBtn}
                  onPress={() => setShowInsufficientBalanceModal(false)}
                  activeOpacity={0.5}
                >
                  <Text style={styles.insufficientModalCloseText}>{t("me.cancel")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
        {showGiftModal && (
          <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={handleCloseGiftModal}>
            <TouchableWithoutFeedback onPress={handleCloseGiftModal}>
              <View style={styles.giftModalBackdrop}>
                <TouchableWithoutFeedback onPress={() => {}}>
                  <View style={styles.giftModal}>
                <View style={styles.giftModalHeader}>
                  <TouchableOpacity style={styles.giftGoldPill} activeOpacity={0.5}>
                    <View style={styles.giftGoldPillContent}>
                      <Text style={styles.goldCoinIcon}>🪙</Text>
                      <View>
                        <Text style={styles.giftGoldText}>{goldBalance}</Text>
                        <Text style={styles.giftGoldSubtext}>{t("me.charged")} {chargedGold} · {t("me.free")} {freeGold}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                  <View style={styles.giftModalIcons}>
                    <TouchableOpacity style={styles.giftHeaderIcon}>
                      <Ionicons name="shield-outline" size={20} color={TEXT_MUTED} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.giftHeaderIcon}>
                      <Ionicons name="sparkles-outline" size={20} color={TEXT_MUTED} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.giftHeaderIcon, styles.giftHeaderIconActive]}>
                      <Ionicons name="gift" size={20} color="#fbbf24" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.giftGrid}>
                    {GIFT_ITEMS.map((item, i) => (
                      <GiftGridItem
                        key={i}
                        item={item}
                        selected={selectedGiftIndex === i}
                        index={i}
                        onSelect={setSelectedGiftIndex}
                        giftItemStyle={styles.giftItem}
                        giftItemSelectedStyle={styles.giftItemSelected}
                        giftItemImageStyle={styles.giftItemImage}
                        giftItemNameStyle={styles.giftItemName}
                        giftItemCostRowStyle={styles.giftItemCostRow}
                        giftItemCostStyle={styles.giftItemCost}
                        goldCoinIconStyle={styles.goldCoinIcon}
                      />
                    ))}
                </View>
                <View style={styles.giftPagination}>
                  <View style={[styles.giftDot, styles.giftDotActive]} />
                  <View style={styles.giftDot} />
                </View>
                <View style={styles.giftModalFooter}>
                  <View style={styles.giftQuantityPill}>
                    <Ionicons name="gift-outline" size={18} color={TEXT_LIGHT} />
                    <Text style={styles.giftQuantityText}>{giftQuantity}</Text>
                    <TouchableOpacity onPress={() => setGiftQuantity((q) => Math.min(q + 1, 99))} hitSlop={8}>
                      <Ionicons name="chevron-up" size={18} color={TEXT_LIGHT} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setGiftQuantity((q) => Math.max(1, q - 1))} hitSlop={8}>
                      <Ionicons name="chevron-down" size={18} color={TEXT_LIGHT} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.giftSendBtn} onPress={handleSendGift} activeOpacity={0.5}>
                    <Text style={styles.giftSendText}>{t("chat.send")}</Text>
                  </TouchableOpacity>
                </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        )}

        <Modal visible={!!bonusModal} transparent animationType="fade">
          <View style={styles.bonusModalOverlay}>
            <TouchableOpacity style={styles.bonusModalBackdrop} activeOpacity={1} onPress={() => setBonusModal(null)} />
            <View style={styles.bonusModalCard}>
              <Text style={styles.bonusModalEmoji}>🎉</Text>
              <Text style={styles.bonusModalTitle}>{t("chat.congratulations")}</Text>
              <Text style={styles.bonusModalText}>{t("chat.bonusReceived").replace("{amount}", String(bonusModal?.reward ?? 15))}</Text>
              <TouchableOpacity style={styles.bonusModalBtn} onPress={() => setBonusModal(null)} activeOpacity={0.5}>
                <Text style={styles.bonusModalBtnText}>{t("chat.ok")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  replyPreviewName: {
    fontSize: 12,
    color: "#f9a8d4",
    marginBottom: 2,
  },
  replyPreviewText: { fontSize: 12, color: "#e5e7eb" },
  failedRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end" },
  failedText: { fontSize: 11, color: "#f87171", fontWeight: "700" },
  msgAvatarMine: { width: 34, height: 34, borderRadius: 8, marginLeft: 6 },
  msgAvatarOther: { width: 34, height: 34, borderRadius: 8, marginRight: 6 },
  inputArea: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: Platform.OS === "ios" ? 34 : 59,
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
  emojiSection: {
    marginBottom: 4,
  },
  emojiSectionLabel: {
    fontSize: 13,
    color: "#e2e8f0",
    marginBottom: 4,
    textAlign: "right",
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
  emojiScroll: {
    maxHeight: 180,
  },
  emojiActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.25)",
  },
  emojiActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiActionBtnDisabled: {
    opacity: 0.5,
  },
  specialStandalone: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  imageBubble: {
    width: 180,
    height: 200,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "90%",
    height: "80%",
    borderRadius: 16,
  },
  giftModalBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },
  giftModal: {
    backgroundColor: "#1e1b2e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  giftModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  giftGoldPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(251,191,36,0.2)",
  },
  giftGoldPillContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  giftGoldText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fbbf24",
  },
  giftGoldSubtext: {
    fontSize: 11,
    color: "rgba(251,191,36,0.85)",
    marginTop: 2,
  },
  giftModalIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  giftHeaderIcon: {
    padding: 6,
  },
  giftHeaderIconActive: {
    opacity: 1,
  },
  giftGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: SCREEN_WIDTH - 32,
  },
  giftItem: {
    width: (SCREEN_WIDTH - 32 - 24) / 4,
    alignItems: "center",
    marginBottom: 16,
  },
  giftItemSelected: {
    borderWidth: 2,
    borderColor: "#a855f7",
    borderRadius: 10,
    padding: 4,
    margin: -4,
  },
  giftItemImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(148,163,184,0.2)",
    marginBottom: 6,
  },
  giftItemName: {
    fontSize: 11,
    color: TEXT_LIGHT,
    marginBottom: 4,
    width: "100%",
    textAlign: "center",
  },
  giftItemCostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  giftItemCost: {
    fontSize: 12,
    color: "#fbbf24",
    fontWeight: "600",
  },
  giftPagination: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginVertical: 12,
  },
  giftDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(148,163,184,0.4)",
  },
  giftDotActive: {
    backgroundColor: "#e2e8f0",
  },
  giftModalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  giftQuantityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.15)",
  },
  giftQuantityText: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
  giftSendBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#a855f7",
    alignItems: "center",
    justifyContent: "center",
  },
  giftSendText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  giftCloseBtn: {
    position: "absolute",
    top: 12,
    left: 16,
    padding: 4,
  },
  giftLottie: {
    width: 90,
    height: 90,
  },
  giftChatImage: {
    width: 80,
    height: 80,
    borderRadius: 24,
    marginBottom: 6,
  },
  giftChatCostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  giftChatAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fbbf24",
  },
  giftCardBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#d9c7ff",
    gap: 10,
    maxWidth: BUBBLE_MAX_WIDTH,
    minWidth: BUBBLE_MAX_WIDTH * 0.7,
    alignSelf: "flex-start",
  },
  giftCardImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  giftCardContent: {
    flex: 1,
    alignItems: "flex-start",
    gap: 4,
  },
  giftCardTitle: {
    fontSize: 13,
    color: "#33225c",
    fontWeight: "700",
    textAlign: "left",
  },
  giftCardSubtitle: {
    fontSize: 12,
    color: "#6b567f",
    textAlign: "left",
  },
  giftCardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 3,
  },
  giftPlayBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(168,85,247,0.16)",
  },
  giftCardGoldRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  giftCardGoldText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fbbf24",
  },
  goldCoinIcon: {
    fontSize: 14,
    marginRight: 2,
  },
  giftIconAnim: {
    width: 36,
    height: 36,
  },
  giftOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  giftOverlayLottie: {
    width: "80%",
    height: "80%",
  },
  quickGiftContainer: {
    position: "absolute",
    left: 20,
    bottom: Platform.OS === "ios" ? 110 : 90,
  },
  quickGiftCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#f5f3ff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  quickGiftRing: {
    position: "absolute",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  quickGiftTick: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: "#a855f7",
    marginTop: 2,
  },
  quickGiftEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  quickGiftCount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
  },
  quickGiftText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7c3aed",
  },
  bottomActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -10,
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
    fontSize: 26,
  },
  diceLottie: {
    width: 48,
    height: 48,
  },
  diceImage: {
    width: 40,
    height: 32,
  },
  rpsEmoji: {
    fontSize: 24,
  },
  specialHint: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
  insufficientModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  insufficientModalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#1e1b2e",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  insufficientModalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(251,191,36,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(251,191,36,0.4)",
  },
  insufficientModalIcon: {
    fontSize: 36,
  },
  insufficientModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT_LIGHT,
    marginBottom: 8,
  },
  insufficientModalSubtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  insufficientModalBtnWrap: {
    width: "100%",
    marginBottom: 12,
  },
  insufficientModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#a855f7", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  insufficientModalBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  insufficientModalCloseBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  insufficientModalCloseText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  bonusModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  bonusModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bonusModalCard: {
    width: "85%",
    maxWidth: 320,
    backgroundColor: BG,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.4)",
    ...Platform.select({
      ios: { shadowColor: "#a855f7", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  bonusModalEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  bonusModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 8,
  },
  bonusModalText: {
    fontSize: 16,
    color: TEXT_MUTED,
    marginBottom: 20,
  },
  bonusModalBtn: {
    backgroundColor: "#a855f7",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  bonusModalBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
