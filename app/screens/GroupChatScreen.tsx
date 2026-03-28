import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  TouchableWithoutFeedback,
  Pressable,
  Platform,
  Text,
  ScrollView,
  Dimensions,
  Image,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import diceAnim from "../../assets/animations/dice.json";
import giftBoxAnim from "../../assets/animations/Gift box.json";
import peacockAnim from "../../assets/animations/Peacock The Beauty of Nature.json";
import dragonAnim from "../../assets/animations/Dragon.json";
import spaceAnim from "../../assets/animations/space.json";
import loveAnim from "../../assets/animations/Love.json";
import birdAnim from "../../assets/animations/Bird pair love and flying sky.json";
import ghostAnim from "../../assets/animations/Ghost emoji animation.json";
import roseAnim from "../../assets/animations/rose.json";
import flowerAnim from "../../assets/animations/floer.json";
import {
  joinGroupChat,
  leaveGroupChat,
  fetchGroupChatMessages,
  getCachedGroupChatMessages,
  sendGroupChatMessage,
  deleteGroupChatMessage,
  setGroupChatMessagesCache,
  getGroupChatMessagesCache,
  uploadGroupChatMusic,
  groupChatMusicControl,
  uploadImageMessage,
  fetchGroupChatUsers,
  fetchGroupChatSlots,
  setGroupChatSlot,
  getGroupChatVoiceToken,
  type GroupChatMessage,
  type GroupChatUser,
  type GroupChatSlot,
  type GroupChatMusicState,
} from "../../utils/messagesApi";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { connectLiveKitVoice, setLiveKitMicrophoneEnabled, setLiveKitSpeakerMute, subscribeToLocalAudio } from "../../utils/livekitVoice";
import { API_BASE_URL } from "../../utils/authHelper";
import * as Clipboard from "expo-clipboard";
import GroupChatMusicPage from "../../components/GroupChatMusicPage";
import GroupChatMusicPlayer from "../../components/GroupChatMusicPlayer";
import LudoGameModal from "../../components/LudoGameModal";
import { fetchWallet } from "../../utils/walletApi";

const MENTION_COLOR = "#38bdf8";

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

function GiftGridItem({
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
}

/** موجات: صوتي فقط عند التحدث مباشر، موسيقى عند التشغيل (حتى مع مايك مغلق) */
function AvatarWithWave({
  size,
  isSpeaking,
  micPermissionGranted,
  isMusicPlaying,
  audioLevel = 0.5,
  children,
}: {
  size: number;
  isSpeaking: boolean;
  micPermissionGranted?: boolean;
  isMusicPlaying?: boolean;
  audioLevel?: number;
  children: React.ReactNode;
}) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const voiceWaves = !!micPermissionGranted && isSpeaking;
  const musicWaves = !!isMusicPlaying;
  const showWaves = voiceWaves || musicWaves;

  useEffect(() => {
    if (!showWaves) {
      ring1.setValue(0);
      ring2.setValue(0);
      ring3.setValue(0);
      return;
    }
    const l = musicWaves ? 0.6 : Math.max(0.2, Math.min(1, audioLevel));
    const duration = 350 + (1 - l) * 180;
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring1, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(ring1, { toValue: 0, duration: 100, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(80),
          Animated.timing(ring2, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(ring2, { toValue: 0, duration: 100, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(160),
          Animated.timing(ring3, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(ring3, { toValue: 0, duration: 100, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [showWaves, audioLevel, musicWaves, ring1, ring2, ring3]);

  if (!showWaves) return <>{children}</>;

  const l = musicWaves ? 0.6 : Math.max(0.2, Math.min(1, audioLevel));
  const ringSize = size + 10 + Math.round(l * 14);
  const opacityMax = 0.5 + l * 0.4;
  const scaleMax = 0.95 + l * 0.45;
  const ringStyle = (anim: Animated.Value) => ({
    position: "absolute" as const,
    width: ringSize,
    height: ringSize,
    borderRadius: ringSize / 2,
    borderWidth: 1 + Math.round(l),
    borderColor: "rgba(255,255,255,0.9)",
    left: -ringSize / 2 + size / 2,
    top: -ringSize / 2 + size / 2,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [opacityMax, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, scaleMax] }) }],
  });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center", overflow: "visible" }}>
      <Animated.View style={ringStyle(ring1)} pointerEvents="none" />
      <Animated.View style={ringStyle(ring2)} pointerEvents="none" />
      <Animated.View style={ringStyle(ring3)} pointerEvents="none" />
      {children}
    </View>
  );
}

function parseDiceFromText(text: string | null | undefined): { isDice: boolean; value: number | null } {
  if (!text) return { isDice: false, value: null };
  if (!text.startsWith("🎲")) return { isDice: false, value: null };
  const match = text.match(/(\d+)/);
  if (!match) return { isDice: true, value: null };
  const num = parseInt(match[1], 10);
  if (!Number.isFinite(num) || num < 1 || num > 6) return { isDice: true, value: null };
  return { isDice: true, value: num };
}

function diceFaceForValue(value: number | null | undefined) {
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
}

// صفوف الإيموجي — نفس الرسائل الخاصة
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

function renderMessageWithMentions(
  text: string,
  baseStyle: object,
  onOpenProfile?: (slot: { userId: string; name?: string; profileImage?: string | null }) => void,
  userIdToProfileImage?: Record<string, string | null | undefined>
) {
  const mentionRegex = /@\s*\[([^\]]+)\]([^\s]*)|(@[^\s]+)/g;
  const parts: { type: "text" | "mention"; text: string; userId?: string; name?: string }[] = [];
  let match;
  let lastIndex = 0;
  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      const displayText = match[2] ? `@${match[2]}` : match[0].trim();
      parts.push({ type: "mention", text: displayText, userId: match[1], name: match[2] || undefined });
    } else {
      parts.push({ type: "mention", text: match[3] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignSelf: "stretch", maxWidth: BUBBLE_WIDTH }}>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return <Text key={i} style={baseStyle}>{part.text}</Text>;
        }
        const mentionStyle = [baseStyle, { color: MENTION_COLOR }];
        const mentionText = <Text style={mentionStyle}>{part.text}</Text>;
        if (part.userId && onOpenProfile) {
          const profileImage = userIdToProfileImage?.[part.userId] ?? null;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onOpenProfile({ userId: part.userId!, name: part.name, profileImage })}
              activeOpacity={0.6}
              style={{ alignSelf: "baseline" }}
            >
              {mentionText}
            </TouchableOpacity>
          );
        }
        return <Text key={i} style={mentionStyle}>{part.text}</Text>;
      })}
    </View>
  );
}

function getImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/uploads/${url.replace(/^\//, "")}`;
}

const BG_DARK = "#1a1625";
const TEXT_LIGHT = "#f5f3ff";
const BUBBLE_WIDTH = Math.min(260, Dimensions.get("window").width * 0.78);

type GiftRecipientInfo = { userId: string; name: string; profileImage?: string | null };

type LocalGroupMsg = GroupChatMessage & {
  specialType?: "dice" | "rps" | "gift" | "join" | "welcome";
  specialAnimating?: boolean;
  diceValue?: number | null;
  giftType?: string | null;
  giftAmount?: number | null;
  giftToName?: string | null;
  giftToProfileImage?: string | null;
  giftRecipients?: GiftRecipientInfo[];
};

type SlotInfo = { userId: string; name?: string; profileImage?: string | null };

type GroupChatMessageItemProps = {
  item: LocalGroupMsg;
  isMe: boolean;
  hasFailed: boolean;
  diceFinalValuesRef: React.MutableRefObject<Map<string, number>>;
  onMention: (fromId: string, fromName: string, fromProfileImage?: string | null) => void;
  onDiceAnimEnd: (id: string) => void;
  onBubbleLongPress: (item: GroupChatMessage) => void;
  onRetry: (item: GroupChatMessage) => void;
  onPreviewImage?: (uri: string) => void;
  onOpenProfile?: (slot: SlotInfo) => void;
  onSendWelcome?: (toUserId: string, toName: string) => void;
  onPlayGift?: (giftType: string) => void;
  userIdToProfileImageMap: Record<string, string | null | undefined>;
  bubbleRefs: React.MutableRefObject<Record<string, View | null>>;
  /** loosen typing to avoid ImageStyle overload issues */
  styles: any;
};

const GroupChatMessageItem = memo(function GroupChatMessageItem({
  item,
  isMe,
  hasFailed,
  diceFinalValuesRef,
  onMention,
  onDiceAnimEnd,
  onBubbleLongPress,
  onRetry,
  onPreviewImage,
  onOpenProfile,
  onSendWelcome,
  onPlayGift,
  userIdToProfileImageMap,
  bubbleRefs,
  styles,
}: GroupChatMessageItemProps) {
  const diamonds = item.fromDiamonds ?? 0;
  const chargedGold = item.fromChargedGold ?? 0;
  const isDice = item.specialType === "dice" || parseDiceFromText(item.text).isDice || (item.text || "").trim().startsWith("🎲");
  const isRps = item.specialType === "rps" || /[✊✋✌️]/.test(item.text || "");
  const isGift = item.specialType === "gift" || /^GIFT:/.test(item.text || "");
  const isJoin = item.specialType === "join" || (item.text || "").trim() === "__join__";
  const isWelcome = item.specialType === "welcome" || (item.text || "").trim().startsWith("__welcome__:");
  const isSpecial = isDice || isRps || isGift;

  const welcomeName = (() => {
    if (!isWelcome) return null;
    const raw = (item.text || "").trim();
    const parts = raw.split(":");
    return (parts[2] || "").trim() || "مستخدم";
  })();

  if (isJoin) {
    const displayName = (item.fromName || "").trim() || "مستخدم";
    return (
      <View style={styles.joinAnnouncementRow}>
        <View style={styles.joinAnnouncementPill}>
          <Text style={styles.joinAnnouncementText}>
            زائر قادم{" "}
            <Text
              style={styles.joinAnnouncementHighlight}
              onPress={() => onOpenProfile?.({ userId: item.fromId, name: item.fromName, profileImage: item.fromProfileImage })}
            >
              {displayName}
            </Text>
            {" "}رحب بلزائر{" "}
            <Text
              style={styles.joinAnnouncementHighlight}
              onPress={() => onSendWelcome?.(item.fromId, displayName)}
            >
              تحيه
            </Text>
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
      <View style={[styles.msgSenderCol, isMe && styles.msgSenderColMe]}>
        <View style={styles.msgImageNameRow}>
          <TouchableOpacity
            activeOpacity={1}
            onLongPress={() => onMention(item.fromId, item.fromName, item.fromProfileImage)}
            onPress={() => onOpenProfile?.({ userId: item.fromId, name: item.fromName, profileImage: item.fromProfileImage })}
            delayLongPress={250}
          >
            {item.fromProfileImage ? (
              <Image source={{ uri: getImageUrl(item.fromProfileImage) }} style={styles.msgAvatarSquare} />
            ) : (
              <View style={[styles.msgAvatarSquare, styles.placeholderAvatar]}>
                <Ionicons name="person" size={12} color={TEXT_MUTED} />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.msgNameGemsCol}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onOpenProfile?.({ userId: item.fromId, name: item.fromName, profileImage: item.fromProfileImage })}
              onLongPress={() => onMention(item.fromId, item.fromName, item.fromProfileImage)}
              delayLongPress={250}
            >
              <Text style={styles.msgSenderName} numberOfLines={1}>
                {item.fromName}
              </Text>
            </TouchableOpacity>
            <View style={styles.msgGemsRow}>
              <View style={styles.msgGemItem}>
                <Ionicons name="diamond" size={10} color="#60a5fa" />
                <Text style={styles.msgGemCount}>{diamonds === 0 ? "0" : Number(diamonds).toFixed(1)}</Text>
              </View>
              <View style={styles.msgGemItem}>
                <Ionicons name="diamond" size={10} color="#f472b6" />
                <Text style={styles.msgGemCount}>{Number(chargedGold)}</Text>
              </View>
            </View>
          </View>
        </View>
        <View
          ref={(r) => { bubbleRefs.current[item.id] = r; }}
          collapsable={false}
          style={[styles.msgBubbleRow, isMe && styles.msgBubbleRowMe]}
        >
          {isSpecial ? (
            <View style={styles.specialNoBubble}>
              {isDice ? (
                <View style={styles.specialBubbleCenter}>
                  {(item.specialAnimating ?? false) ? (
                    <LottieView
                      source={diceAnim}
                      autoPlay
                      loop={false}
                      style={styles.diceLottie}
                      onAnimationFinish={() => onDiceAnimEnd(item.id)}
                    />
                  ) : (
                    <Image
                      source={diceFaceForValue(diceFinalValuesRef.current.get(item.id) ?? item.diceValue ?? parseDiceFromText(item.text).value)}
                      style={styles.diceImage}
                      resizeMode="contain"
                    />
                  )}
                </View>
              ) : isGift ? (
                <View style={styles.giftCardBubble}>
                  {item.toId ? (
                    <View style={styles.giftCardToRow}>
                      {item.giftToProfileImage ? (
                        <Image source={{ uri: getImageUrl(item.giftToProfileImage) }} style={styles.giftCardToAvatar} />
                      ) : (
                        <View style={[styles.giftCardToAvatar, styles.giftCardToAvatarPlaceholder]}>
                          <Ionicons name="person" size={14} color="#6b567f" />
                        </View>
                      )}
                      <Text style={styles.giftCardToText} numberOfLines={1}>
                        ارسل هديه الى {item.giftToName || "مستخدم"}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.giftCardRow, item.toId && styles.giftCardRowWithTo]}>
                    <Image
                      source={
                        item.giftType === "dragon"
                          ? require("../../assets/images/tenen.jpg")
                          : item.giftType === "space"
                          ? require("../../assets/images/spec.jpj.png")
                          : item.giftType === "love"
                          ? require("../../assets/images/love.jpg")
                          : item.giftType === "bird"
                          ? require("../../assets/images/perd.jpg")
                          : item.giftType === "ghost"
                          ? require("../../assets/images/chost.jpg")
                          : item.giftType === "rose"
                          ? require("../../assets/images/تنزيل.png")
                          : item.giftType === "flower"
                          ? require("../../assets/images/flo.jpg")
                          : require("../../assets/images/taws.jpg")
                      }
                      style={styles.giftCardImage}
                      resizeMode="cover"
                    />
                    <View style={styles.giftCardContent}>
                      {!item.toId ? <Text style={styles.giftCardTitle}>هدية للجماعة</Text> : null}
                      <Text style={styles.giftCardSubtitle}>
                        {item.giftType === "dragon"
                          ? "تنين وردي"
                          : item.giftType === "space"
                          ? "رجل فضاء"
                          : item.giftType === "love"
                          ? "رسالة حب"
                          : item.giftType === "bird"
                          ? "طيور حب"
                          : item.giftType === "ghost"
                          ? "شبح"
                          : item.giftType === "rose"
                          ? "وردة"
                          : item.giftType === "flower"
                          ? "زهرة كرز"
                          : "طاوس"}{" "}
                        x{(() => {
                          const base = item.giftType === "peacock" ? 500 : item.giftType === "dragon" ? 100 : item.giftType === "space" ? 25 : item.giftType === "love" ? 10 : item.giftType === "bird" ? 45 : item.giftType === "ghost" ? 5 : item.giftType === "rose" ? 1 : 200;
                          return Math.max(1, Math.round((item.giftAmount ?? 0) / (base || 1)));
                        })()}
                      </Text>
                      <View style={styles.giftCardBottomRow}>
                        {onPlayGift ? (
                          <TouchableOpacity
                            style={styles.giftPlayBtn}
                            activeOpacity={0.5}
                            onPress={() =>
                              onPlayGift(
                                item.giftType === "dragon"
                                  ? "dragon"
                                  : item.giftType === "space"
                                  ? "space"
                                  : item.giftType === "love"
                                  ? "love"
                                  : item.giftType === "bird"
                                  ? "bird"
                                  : item.giftType === "ghost"
                                  ? "ghost"
                                  : item.giftType === "rose"
                                  ? "rose"
                                  : item.giftType === "flower"
                                  ? "flower"
                                  : "peacock"
                              )
                            }
                          >
                            <Ionicons name="play-circle" size={18} color="#a855f7" />
                          </TouchableOpacity>
                        ) : null}
                        <Text style={styles.giftCardAmount}>🪙 {item.giftAmount ?? 0}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.specialBubbleCenter}>
                  <Text style={styles.rpsEmoji}>{item.text}</Text>
                </View>
              )}
              <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeOther]}>
                {item.createdAt ? new Date(item.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : ""}
              </Text>
              {isMe && hasFailed ? (
                <TouchableOpacity style={styles.msgFailedBtn} onPress={() => onRetry(item)} activeOpacity={0.5}>
                  <Ionicons name="alert-circle" size={18} color="#ef4444" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.msgBubble,
                  isMe && styles.msgBubbleMe,
                  {
                    backgroundColor: isMe ? ACCENT : "#ffffff",
                    minHeight: 44,
                    minWidth: 60,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onLongPress={() => onBubbleLongPress(item)}
                  delayLongPress={180}
                  style={{ flex: 1 }}
                >
                  {item.replyToText ? (
                    <View style={[styles.msgReplyBox, isMe && styles.msgReplyBoxMe]}>
                      <Text style={[styles.msgReplyLabel, isMe && styles.msgReplyLabelMe]} numberOfLines={1}>
                        {item.replyToFromName || "رد"}
                      </Text>
                      <Text style={[styles.msgReplyText, isMe && styles.msgReplyTextMe]} numberOfLines={2}>
                        {item.replyToText}
                      </Text>
                    </View>
                  ) : null}
                  {item.imageUrl ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => {
                      const uri = item.imageUrl!.startsWith("file") ? item.imageUrl! : getImageUrl(item.imageUrl!);
                      onPreviewImage?.(uri);
                    }}>
                      <Image source={{ uri: item.imageUrl.startsWith("file") ? item.imageUrl : getImageUrl(item.imageUrl) }} style={styles.msgImageBubble} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : null}
                  {(!item.imageUrl || item.text !== "📷 صورة") ? (
                    isWelcome ? (
                      <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                        اهلا بك في عائلتنا{" "}
                        <Text style={styles.joinAnnouncementHighlight}>{welcomeName}</Text>
                      </Text>
                    ) : (
                      renderMessageWithMentions(item.text ?? "", [styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther], onOpenProfile, userIdToProfileImageMap)
                    )
                  ) : null}
                  <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeOther]}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </Text>
                </TouchableOpacity>
              </View>
              {isMe && hasFailed ? (
                <TouchableOpacity style={styles.msgFailedBtn} onPress={() => onRetry(item)} activeOpacity={0.5}>
                  <Ionicons name="alert-circle" size={18} color="#ef4444" />
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>
    </View>
  );
});

function parseGiftFromText(text: string | null | undefined): { isGift: boolean; giftType: string | null; amount: number | null } {
  if (!text) return { isGift: false, giftType: null, amount: null };
  const match = text.match(/^GIFT:([^:]+):(\d+)/);
  if (!match) return { isGift: false, giftType: null, amount: null };
  const amount = parseInt(match[2], 10);
  if (!Number.isFinite(amount) || amount <= 0) return { isGift: false, giftType: null, amount: null };
  return { isGift: true, giftType: match[1], amount };
}

function mapToLocalMsg(m: GroupChatMessage, extra?: Partial<LocalGroupMsg>): LocalGroupMsg {
  const textTrim = (m.text || "").trim();
  const isJoinMsg = textTrim === "__join__";
  const isWelcomeMsg = textTrim.startsWith("__welcome__:");
  const { isDice, value } = parseDiceFromText(m.text);
  const isRps = /[✊✋✌️]/.test(m.text || "");
  const { isGift, giftType, amount } = parseGiftFromText(m.text);
  const base = m as { giftToName?: string; giftToProfileImage?: string; giftRecipients?: GiftRecipientInfo[] };
  const giftRecipients = extra?.giftRecipients ?? (Array.isArray(base.giftRecipients) && base.giftRecipients.length > 0 ? base.giftRecipients : undefined);
  const giftToName = extra?.giftToName ?? base.giftToName ?? (giftRecipients?.length === 1 ? giftRecipients[0].name : null);
  const giftToProfileImage = extra?.giftToProfileImage ?? base.giftToProfileImage ?? (giftRecipients?.length === 1 ? giftRecipients[0].profileImage : null);
  return {
    ...m,
    ...(extra || {}),
    specialType: extra?.specialType ?? (isWelcomeMsg ? "welcome" : isJoinMsg ? "join" : isDice ? "dice" : isRps ? "rps" : isGift ? "gift" : undefined),
    diceValue: extra?.diceValue ?? (isDice ? value : undefined),
    giftType: extra?.giftType ?? (isGift ? giftType : null),
    giftAmount: extra?.giftAmount ?? (isGift ? amount : null),
    giftToName,
    giftToProfileImage,
    giftRecipients,
  };
}

type UserInfo = { id?: string; name?: string; profileImage?: string };
type Props = {
  user: UserInfo | null;
  selectedSlot?: string | null;
  onSelectedSlotChange?: (userId: string | null) => void;
  onBack: () => void;
  onOpenTopup?: () => void;
  onOpenUsers?: () => void;
  onOpenProfile?: (slot: SlotInfo) => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AVATAR_COLS = 4;
const AVATAR_GAP = 10;
const CARD_BG = "rgba(45, 38, 64, 0.6)";
const TEXT_MUTED = "#a1a1aa";
const ACCENT = "#a78bfa";

export default function GroupChatScreen({ user, onBack, onOpenUsers, onOpenProfile, onOpenTopup }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mySlotIndex, setMySlotIndex] = useState<number | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [liveKitAudioLevel, setLiveKitAudioLevel] = useState(0);
  const [liveKitIsSpeaking, setLiveKitIsSpeaking] = useState(false);
  const liveKitAudioUnsubRef = useRef<(() => void) | null>(null);
  const isSpeaking = !!micPermissionGranted && !micMuted && mySlotIndex != null && liveKitIsSpeaking;
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [showMusicPage, setShowMusicPage] = useState(false);
  const [showMusicPlayer, setShowMusicPlayer] = useState(true);
  const [showLudo, setShowLudo] = useState(false);
  const [musicRefreshTrigger, setMusicRefreshTrigger] = useState(0);
  const [musicUploading, setMusicUploading] = useState(false);
  const [musicIsPlaying, setMusicIsPlaying] = useState(false);
  const [musicImmediateState, setMusicImmediateState] = useState<GroupChatMusicState | null>(null);
  const [messages, setMessages] = useState<LocalGroupMsg[]>(() =>
    (getGroupChatMessagesCache() as GroupChatMessage[]).map((m) => mapToLocalMsg(m))
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [mentionPrefix, setMentionPrefix] = useState<string | null>(null);
  const [mentionData, setMentionData] = useState<{ userId: string; name: string; profileImage?: string | null } | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [bubbleMenu, setBubbleMenu] = useState<{ messageId: string; text: string; fromId: string; fromName: string; isMe: boolean; x: number; y: number; w: number; h: number } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(["😘", "🤣", "🌹", "✌️", "🙂", "😂"]);
  const bubbleRefs = useRef<Record<string, View | null>>({});
  const [replyTo, setReplyTo] = useState<{ replyToText: string; replyToFromId: string; replyToFromName: string } | null>(null);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const failedIdsRef = useRef(failedIds);
  failedIdsRef.current = failedIds;
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedGiftIndex, setSelectedGiftIndex] = useState(0);
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [goldBalance, setGoldBalance] = useState(0);
  const [chargedGold, setChargedGold] = useState(0);
  const [freeGold, setFreeGold] = useState(0);
  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] = useState(false);
  const [roomUsers, setRoomUsers] = useState<GroupChatUser[]>([]);
  const roomUsersRef = useRef(roomUsers);
  roomUsersRef.current = roomUsers;
  const [showGiftRecipientBar, setShowGiftRecipientBar] = useState(false);
  const [giftAllSelected, setGiftAllSelected] = useState(true);
  const [giftSelectedUserIds, setGiftSelectedUserIds] = useState<string[]>([]);
  const [giftSlots, setGiftSlots] = useState<GroupChatSlot[]>([]);
  const [voiceSlots, setVoiceSlots] = useState<(GroupChatSlot | null)[]>(Array(8).fill(null));
  const [giftOverlayType, setGiftOverlayType] = useState<"peacock" | "dragon" | "space" | "love" | "bird" | "ghost" | "rose" | "flower" | null>(null);
  const [showGiftOverlay, setShowGiftOverlay] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const inputRef = useRef<TextInput>(null);
  const initialScrollDone = useRef(false);
  const liveKitDisconnectRef = useRef<(() => void) | null>(null);
  const currentUserId = user?.id || "";

  const [joinToast, setJoinToast] = useState<{ key: string; name: string; isMe: boolean } | null>(null);
  const joinToastAnim = useRef(new Animated.Value(0)).current;
  const joinToastX = useRef(new Animated.Value(0)).current;
  const joinToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownJoinIdsRef = useRef<Set<string>>(new Set());
  const joinExpireTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const loadingMessagesRef = useRef(false);
  const loadingUsersSlotsRef = useRef(false);
  const lastUsersSlotsSigRef = useRef<string>("");

  const showJoinToast = useCallback((name: string, isMe: boolean) => {
    const n = (name || "").trim() || "مستخدم";
    const key = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setJoinToast({ key, name: n, isMe });

    if (joinToastTimerRef.current) clearTimeout(joinToastTimerRef.current);

    joinToastAnim.stopAnimation();
    joinToastX.stopAnimation();
    joinToastAnim.setValue(0);
    joinToastX.setValue(isMe ? -Math.min(240, SCREEN_WIDTH * 0.6) : 0);

    Animated.parallel([
      Animated.timing(joinToastAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(joinToastX, { toValue: 0, duration: isMe ? 240 : 0, useNativeDriver: true }),
    ]).start();

    joinToastTimerRef.current = setTimeout(() => {
      Animated.timing(joinToastAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setJoinToast(null);
      });
    }, 2000);
  }, [joinToastAnim, joinToastX]);

  useEffect(() => {
    if (mySlotIndex != null) {
      const backendSlotIndex = mySlotIndex - 1;
      let cancelled = false;

      /** يظهر avatarك فور الضغط على + دون انتظار السيرفر */
      setVoiceSlots((prev) => {
        const next = [...prev];
        if (user && currentUserId) {
          next[backendSlotIndex] = {
            slotIndex: backendSlotIndex,
            userId: currentUserId,
            name: user.name || "مستخدم",
            profileImage: user.profileImage ?? null,
            totalGold: 0,
            chargedGold: 0,
            diamonds: 0,
          };
        }
        return next;
      });

      (async () => {
        try {
          const [perm, slotsRes] = await Promise.all([
            Audio.requestPermissionsAsync(),
            setGroupChatSlot(backendSlotIndex),
          ]);
          if (cancelled) return;

          if (slotsRes) {
            setGiftSlots(slotsRes.filter((s): s is NonNullable<typeof s> => s != null));
            setVoiceSlots(slotsRes);
          } else {
            Alert.alert("خطأ", "تعذّر حجز المقعد. حاول مرة أخرى.");
            setMySlotIndex(null);
            const fresh = await fetchGroupChatSlots();
            setVoiceSlots(fresh);
            return;
          }

          const granted = perm.status === "granted";
          setMicPermissionGranted(granted);
          if (!granted) {
            Alert.alert(
              "إذن المايكروفون",
              "يُرجى منح إذن المايكروفون من الإعدادات لسماع صوتك مباشرة في الدردشة.",
              [{ text: "حسناً", onPress: () => setMySlotIndex(null) }]
            );
            return;
          }

          const tokenData = await getGroupChatVoiceToken();
          if (cancelled) return;
          if (!tokenData) {
            Alert.alert("خطأ الاتصال", "تعذر الحصول على توكن الصوت. تحقق من اتصالك بالإنترنت.");
            setMySlotIndex(null);
            return;
          }
          const disconnect = await connectLiveKitVoice(tokenData.token, tokenData.wsUrl);
          if (cancelled) {
            disconnect();
            return;
          }
          liveKitDisconnectRef.current = disconnect;
          await setLiveKitMicrophoneEnabled(true);
          liveKitAudioUnsubRef.current?.();
          liveKitAudioUnsubRef.current = subscribeToLocalAudio((level, speaking) => {
            setLiveKitAudioLevel(level);
            setLiveKitIsSpeaking(speaking);
          });
        } catch (err) {
          if (cancelled) return;
          const msg = (err as Error)?.message || "فشل الاتصال";
          Alert.alert("خطأ الاتصال", `تعذر الاتصال بصوت الغرفة: ${msg}`);
          setMySlotIndex(null);
        }
      })();

      return () => {
        cancelled = true;
        liveKitAudioUnsubRef.current?.();
        liveKitAudioUnsubRef.current = null;
        setLiveKitIsSpeaking(false);
        setLiveKitAudioLevel(0);
        liveKitDisconnectRef.current?.();
        liveKitDisconnectRef.current = null;
        setMicPermissionGranted(false);
        void setGroupChatSlot(null);
      };
    } else {
      liveKitDisconnectRef.current?.();
      liveKitDisconnectRef.current = null;
      setMicPermissionGranted(false);
      void setGroupChatSlot(null);
    }
  }, [mySlotIndex, user, currentUserId]);

  const failedIdsExtra = useMemo(() => Array.from(failedIds).sort().join(","), [failedIds]);

  /** توقيع ثابت لصور المرسلين — عند تطابقه لا نُعيد كائن الخريطة فيبقى renderItem مستقرًا وmemo القائمة يعمل */
  const profileImageUrlsSig = useMemo(() => {
    const slice = messages.length > 100 ? messages.slice(-100) : messages;
    const pairs: string[] = [];
    const seen = new Set<string>();
    for (const m of slice) {
      if (m.fromId && m.fromProfileImage && !seen.has(m.fromId)) {
        seen.add(m.fromId);
        pairs.push(`${m.fromId}\0${getImageUrl(m.fromProfileImage)}`);
      }
    }
    pairs.sort();
    return pairs.join("\x01");
  }, [messages]);

  const userIdToProfileImageMap = useMemo(() => {
    const list = messagesRef.current;
    const map: Record<string, string> = {};
    const slice = list.length > 100 ? list.slice(-100) : list;
    for (const m of slice) {
      if (m.fromId && m.fromProfileImage && !map[m.fromId]) {
        map[m.fromId] = getImageUrl(m.fromProfileImage);
      }
    }
    return map;
  }, [profileImageUrlsSig]);

  const joinTailIdsSig = useMemo(() => {
    const parts: string[] = [];
    for (let i = Math.max(0, messages.length - 20); i < messages.length; i++) {
      const m = messages[i];
      if (!m) continue;
      if ((m.text || "").trim() !== "__join__") continue;
      parts.push(String(m.id));
    }
    return parts.join(",");
  }, [messages]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const mapMsgs = useCallback((arr: GroupChatMessage[]) => arr.map((m) => mapToLocalMsg(m)), []);

  const loadMessages = useCallback((silent = false) => {
    if (loadingMessagesRef.current) return;
    loadingMessagesRef.current = true;
    if (!silent) setLoading(true);

    const mergePending = (
      prev: LocalGroupMsg[],
      mapped: LocalGroupMsg[]
    ): LocalGroupMsg[] => {
      const pending = prev.filter((m) => String(m.id).startsWith("temp_"));
      if (pending.length === 0) return mapped;
      const serverIds = new Set(mapped.map((x) => x.id));
      const toAdd = pending.filter((p) => !serverIds.has(p.id));
      return toAdd.length > 0 ? [...mapped, ...toAdd] : mapped;
    };

    const sameByIdSig = (prev: LocalGroupMsg[], next: LocalGroupMsg[]) => {
      if (prev.length !== next.length) return false;
      const sig = next.map((m) => m.id).join("\u001e");
      return prev.map((m) => m.id).join("\u001e") === sig;
    };

    if (!silent) {
      setMessages((prev) => {
        const memCached = mapMsgs(getGroupChatMessagesCache());
        if (memCached.length === 0) return prev;
        const merged = mergePending(prev, memCached);
        return sameByIdSig(prev, merged) ? prev : merged;
      });
      getCachedGroupChatMessages().then((stored) => {
        if (stored.length === 0) return;
        setMessages((prev) => {
          const mapped = mapMsgs(stored);
          const merged = mergePending(prev, mapped);
          return sameByIdSig(prev, merged) ? prev : merged;
        });
      });
    }

    void fetchGroupChatMessages()
      .then((msgs) => {
        const mapped = mapMsgs(msgs);
        const sig = mapped.map((m) => m.id).join("\u001e");
        setMessages((prev) => {
          const pending = prev.filter((m) => String(m.id).startsWith("temp_"));
          if (pending.length === 0) {
            const prevSig = prev.map((m) => m.id).join("\u001e");
            if (prevSig === sig && prev.length === mapped.length) return prev;
            return mapped;
          }
          const serverIds = new Set(mapped.map((x) => x.id));
          const toAdd = pending.filter((p) => !serverIds.has(p.id));
          return toAdd.length > 0 ? [...mapped, ...toAdd] : mapped;
        });
        setGroupChatMessagesCache(msgs);
      })
      .finally(() => {
        loadingMessagesRef.current = false;
        setLoading(false);
      });
  }, [mapMsgs]);

  const fetchUsersAndSlots = useCallback(() => {
    if (loadingUsersSlotsRef.current) return;
    loadingUsersSlotsRef.current = true;
    Promise.all([fetchGroupChatUsers(), fetchGroupChatSlots()]).then(([users, slots]) => {
      const validSlots = slots.filter((s): s is NonNullable<typeof s> => s != null);
      const slotSig = slots.map((s) => s?.userId ?? "").join("\u001e");
      const prev = roomUsersRef.current;
      const merged =
        prev.length === 0
          ? users.slice(0, 100)
          : (() => {
              const prevIds = new Set(prev.map((u) => u.userId));
              const currentIds = new Set(users.map((u) => u.userId));
              const newUsers = users.filter((u) => !prevIds.has(u.userId));
              const existing = prev.filter((p) => currentIds.has(p.userId));
              return [...newUsers, ...existing].slice(0, 100);
            })();
      const slotOrder = validSlots.map((s) => s.userId);
      const slotSet = new Set(slotOrder);
      const inSlots = merged.filter((u) => slotSet.has(u.userId));
      const notInSlots = merged.filter((u) => !slotSet.has(u.userId));
      const sortedInSlots = [...inSlots].sort((a, b) => {
        const ai = slotOrder.indexOf(a.userId);
        const bi = slotOrder.indexOf(b.userId);
        return ai - bi;
      });
      const nextList = [...sortedInSlots, ...notInSlots];
      const listSig = nextList.map((u) => u.userId).join("\u001e");
      const fullSig = `${slotSig}\n${listSig}`;
      if (fullSig !== lastUsersSlotsSigRef.current) {
        lastUsersSlotsSigRef.current = fullSig;
        setGiftSlots(validSlots);
        setVoiceSlots(slots);
        setRoomUsers(nextList);
      }
    }).finally(() => {
      loadingUsersSlotsRef.current = false;
    });
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      interruptionModeAndroid: 1,
      interruptionModeIOS: 1,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    joinGroupChat().then(() => {
      fetchUsersAndSlots();
      // عند دخولك أنت: إشعار عائم من اليسار للوسط
      showJoinToast(user?.name || "مستخدم", true);
    }).catch(() => {});
    return () => {
      void leaveGroupChat().catch(() => {});
    };
  }, [fetchUsersAndSlots, showJoinToast, user?.name]);

  useEffect(() => {
    // عند دخول أي مستخدم: إشعار عائم بالوسط لمدة ثانيتين
    for (let i = Math.max(0, messages.length - 12); i < messages.length; i++) {
      const m = messages[i];
      if (!m) continue;
      if ((m.text || "").trim() !== "__join__") continue;
      const id = String(m.id || "");
      if (!id || shownJoinIdsRef.current.has(id)) continue;
      shownJoinIdsRef.current.add(id);
      const name = (m.fromName || "").trim() || "مستخدم";
      const isMe = m.fromId === currentUserId;
      // لا تكرر إشعار دخولك هنا لأننا نعرضه عند joinGroupChat
      if (isMe) continue;
      showJoinToast(name, false);
    }
  }, [joinTailIdsSig, currentUserId, showJoinToast]);

  useEffect(() => {
    // حذف رسالة "زائر قادم ... تحيه" بعد 10 ثواني من ظهورها
    const list = messagesRef.current;
    const now = Date.now();
    for (let i = Math.max(0, list.length - 20); i < list.length; i++) {
      const m = list[i];
      if (!m) continue;
      if ((m.text || "").trim() !== "__join__") continue;
      const id = String(m.id || "");
      if (!id) continue;
      if (joinExpireTimersRef.current[id]) continue;
      const createdAtMs = m.createdAt ? new Date(m.createdAt as any).getTime() : now;
      const delay = Math.max(0, 10_000 - (now - createdAtMs));
      joinExpireTimersRef.current[id] = setTimeout(() => {
        setMessages((prev) => {
          const next = prev.filter((x) => x.id !== id);
          setGroupChatMessagesCache(next as any);
          return next;
        });
        delete joinExpireTimersRef.current[id];
      }, delay);
    }
    return () => {};
  }, [joinTailIdsSig]);

  useEffect(() => {
    return () => {
      // تنظيف المؤقتات عند إغلاق الشاشة
      for (const k of Object.keys(joinExpireTimersRef.current)) {
        try { clearTimeout(joinExpireTimersRef.current[k]); } catch {}
      }
      joinExpireTimersRef.current = {};
      if (joinToastTimerRef.current) {
        try { clearTimeout(joinToastTimerRef.current); } catch {}
        joinToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const mem = getGroupChatMessagesCache();
    if (mem.length > 0) setMessages(mapMsgs(mem));
    getCachedGroupChatMessages().then((stored) => {
      if (stored.length > 0) {
        setMessages((prev) => {
          const mapped = mapMsgs(stored);
          const pending = prev.filter((m) => String(m.id).startsWith("temp_"));
          if (pending.length === 0) return mapped;
          const serverIds = new Set(mapped.map((x) => x.id));
          const toAdd = pending.filter((p) => !serverIds.has(p.id));
          return toAdd.length > 0 ? [...mapped, ...toAdd] : mapped;
        });
      }
    });
    loadMessages(true);
  }, [loadMessages, mapMsgs]);

  /** تحديث الرسائل: استطلاع أبطأ قليلًا يقلل إعادة الرسم والضغط عند نشاط عالٍ */
  useEffect(() => {
    const t = setInterval(() => loadMessages(true), 5200);
    return () => clearInterval(t);
  }, [loadMessages]);

  /** مستخدمون ومقاعد */
  useEffect(() => {
    const interval = showGiftModal ? 3000 : 4500;
    const t = setInterval(fetchUsersAndSlots, interval);
    return () => clearInterval(t);
  }, [showGiftModal, fetchUsersAndSlots]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const msgs = await fetchGroupChatMessages();
    const mapped = mapMsgs(msgs);
    setMessages((prev) => {
      const pending = prev.filter((m) => String(m.id).startsWith("temp_"));
      if (pending.length === 0) return mapped;
      const serverIds = new Set(mapped.map((x) => x.id));
      const toAdd = pending.filter((p) => !serverIds.has(p.id));
      return toAdd.length > 0 ? [...mapped, ...toAdd] : mapped;
    });
    setGroupChatMessagesCache(msgs);
    setRefreshing(false);
  }, [mapMsgs]);

  const handleMention = useCallback((fromId: string, fromName: string, fromProfileImage?: string | null) => {
    setMentionPrefix(`@${fromName} `);
    setMentionData({ userId: fromId, name: fromName, profileImage: fromProfileImage });
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const handleBubbleLongPress = useCallback((item: GroupChatMessage) => {
    const ref = bubbleRefs.current[item.id];
    const isMe = item.fromId === currentUserId;
    if (ref && "measureInWindow" in ref) {
      (ref as any).measureInWindow((x: number, y: number, w: number, h: number) => {
        setBubbleMenu({ messageId: item.id, text: item.text, fromId: item.fromId, fromName: item.fromName, isMe, x, y, w, h });
      });
    } else {
      setBubbleMenu({ messageId: item.id, text: item.text, fromId: item.fromId, fromName: item.fromName, isMe, x: 0, y: 0, w: 0, h: 0 });
    }
  }, [currentUserId]);

  const handleReplyFromMenu = useCallback(() => {
    if (!bubbleMenu) return;
    setReplyTo({
      replyToText: bubbleMenu.text,
      replyToFromId: bubbleMenu.fromId,
      replyToFromName: bubbleMenu.fromName,
    });
    setBubbleMenu(null);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [bubbleMenu]);

  const handleCopyFromMenu = useCallback(async () => {
    if (!bubbleMenu) return;
    await Clipboard.setStringAsync(bubbleMenu.text);
    setBubbleMenu(null);
  }, [bubbleMenu]);

  // NOTE: declared below `doSendMessage` to avoid TDZ typing issues

  const handleDeleteFromMenu = useCallback(async () => {
    if (!bubbleMenu) return;
    const msgId = bubbleMenu.messageId;
    setBubbleMenu(null);
    const isTemp = String(msgId).startsWith("temp_");
    const ok = isTemp ? true : await deleteGroupChatMessage(msgId);
    if (ok) {
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== msgId);
        setGroupChatMessagesCache(next);
        return next;
      });
    }
  }, [bubbleMenu]);

  const doSendMessage = useCallback(async (fullText: string, tempId: string, replyPayload?: { replyToText: string; replyToFromId: string; replyToFromName: string }, imageUrl?: string | null, giftAmount?: number | null) => {
    setFailedIds((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
    const msgRes = await sendGroupChatMessage(fullText, { ...replyPayload, imageUrl, giftAmount });
    const msg = Array.isArray(msgRes) ? msgRes[msgRes.length - 1] : msgRes;
    if (msg) {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === tempId ? mapToLocalMsg({ ...msg, id: String(msg.id) }) : m));
        setGroupChatMessagesCache(next as any);
        return next;
      });
    } else {
      setFailedIds((prev) => new Set(prev).add(tempId));
    }
  }, []);

  const sendWelcome = useCallback((toUserId: string, toName: string) => {
    if (!currentUserId) return;
    const safeName = (toName || "").trim() || "مستخدم";
    const text = `__welcome__:${toUserId}:${safeName}`;
    const tempId = `temp_welcome_${Date.now()}`;
    const optimistic: GroupChatMessage = {
      id: tempId,
      fromId: currentUserId,
      fromName: user?.name || "مستخدم",
      fromProfileImage: user?.profileImage ?? null,
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => {
      const next = [...prev, mapToLocalMsg(optimistic as any, { specialType: "welcome" })];
      setGroupChatMessagesCache(next as any);
      return next;
    });
    requestAnimationFrame(() => flatRef.current?.scrollToEnd({ animated: true }));
    void doSendMessage(text, tempId);
  }, [currentUserId, user?.name, user?.profileImage, doSendMessage]);

  const handleSend = useCallback(() => {
    const prefix = mentionData ? `@[${mentionData.userId}]${mentionData.name} ` : (mentionPrefix || "");
    const fullText = (prefix + inputText).trim();
    if (!fullText) return;
    const replyPayload = replyTo ? { replyToText: replyTo.replyToText, replyToFromId: replyTo.replyToFromId, replyToFromName: replyTo.replyToFromName } : undefined;
    const tempId = `temp_${Date.now()}`;
    const optimistic: GroupChatMessage = {
      id: tempId,
      fromId: currentUserId,
      fromName: user?.name || "مستخدم",
      fromProfileImage: user?.profileImage ?? null,
      text: fullText,
      createdAt: new Date().toISOString(),
      replyToText: replyPayload?.replyToText ?? null,
      replyToFromId: replyPayload?.replyToFromId ?? null,
      replyToFromName: replyPayload?.replyToFromName ?? null,
    };
    setMessages((prev) => {
      const next = [...prev, optimistic];
      setGroupChatMessagesCache(next);
      return next;
    });
    setInputText("");
    setMentionPrefix(null);
    setMentionData(null);
    setReplyTo(null);
    requestAnimationFrame(() => {
      flatRef.current?.scrollToEnd({ animated: false });
      Keyboard.dismiss();
    });
    doSendMessage(fullText, tempId, replyPayload);
  }, [inputText, mentionPrefix, mentionData, replyTo, currentUserId, user?.name, user?.profileImage, doSendMessage]);

  const addToRecent = useCallback((emoji: string) => {
    setRecentEmojis((prev) => [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 8));
  }, []);

  const diceFinishedIds = useRef<Set<string>>(new Set());
  const diceFallbackTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const diceFinalValuesRef = useRef<Map<string, number>>(new Map());

  const handleDiceAnimEnd = useCallback((id: string) => {
    if (diceFinishedIds.current.has(id)) return;
    diceFinishedIds.current.add(id);
    if (diceFallbackTimers.current[id]) {
      clearTimeout(diceFallbackTimers.current[id]);
      delete diceFallbackTimers.current[id];
    }
    const finalValue = Math.floor(Math.random() * 6) + 1;
    diceFinalValuesRef.current.set(id, finalValue);
    setMessages((prev) => {
      const m = prev.find((x) => x.id === id);
      if (!m || !m.specialAnimating) return prev;
      const replyPayload = m.replyToText && m.replyToFromId && m.replyToFromName
        ? { replyToText: m.replyToText, replyToFromId: m.replyToFromId, replyToFromName: m.replyToFromName }
        : undefined;
      const next = prev.map((msg) => (msg.id === id ? { ...msg, diceValue: finalValue, specialAnimating: false } : msg));
      setGroupChatMessagesCache(next);
      const finalText = `🎲 ${finalValue}`;
      void sendGroupChatMessage(finalText, replyPayload).then((msgRes) => {
        const msg = Array.isArray(msgRes) ? msgRes[msgRes.length - 1] : msgRes;
        if (msg) {
          const newId = String((msg as any).id);
          diceFinalValuesRef.current.set(newId, finalValue);
          diceFinalValuesRef.current.delete(id);
          setMessages((p) => {
            const n = p.map((x) => (x.id === id ? mapToLocalMsg({ ...msg, id: newId }, { specialType: "dice", diceValue: finalValue }) : x));
            setGroupChatMessagesCache(n);
            return n;
          });
        } else {
          setFailedIds((prev) => new Set(prev).add(id));
        }
      });
      return next;
    });
  }, []);

  const handleSendDice = useCallback(() => {
    if (!currentUserId) return;
    const id = `temp_dice_${Date.now()}`;
    const replyPayload = replyTo ? { replyToText: replyTo.replyToText, replyToFromId: replyTo.replyToFromId, replyToFromName: replyTo.replyToFromName } : undefined;
    const optimistic: LocalGroupMsg = mapToLocalMsg({
      id,
      fromId: currentUserId,
      fromName: user?.name || "مستخدم",
      fromProfileImage: user?.profileImage ?? null,
      text: "🎲",
      createdAt: new Date().toISOString(),
      replyToText: replyPayload?.replyToText ?? null,
      replyToFromId: replyPayload?.replyToFromId ?? null,
      replyToFromName: replyPayload?.replyToFromName ?? null,
    }, { specialType: "dice", specialAnimating: true, diceValue: null });
    setMessages((prev) => {
      const next = [...prev, optimistic];
      setGroupChatMessagesCache(next);
      return next;
    });
    setShowEmojiPicker(false);
    requestAnimationFrame(() => flatRef.current?.scrollToEnd({ animated: true }));

    diceFallbackTimers.current[id] = setTimeout(() => handleDiceAnimEnd(id), 2500);
  }, [currentUserId, user?.name, user?.profileImage, replyTo, handleDiceAnimEnd]);

  const handleSendRps = useCallback(() => {
    if (!currentUserId) return;
    const variants = ["✊", "✋", "✌️"];
    const id = `temp_rps_${Date.now()}`;
    const replyPayload = replyTo ? { replyToText: replyTo.replyToText, replyToFromId: replyTo.replyToFromId, replyToFromName: replyTo.replyToFromName } : undefined;
    const optimistic: LocalGroupMsg = mapToLocalMsg({
      id,
      fromId: currentUserId,
      fromName: user?.name || "مستخدم",
      fromProfileImage: user?.profileImage ?? null,
      text: "✊",
      createdAt: new Date().toISOString(),
      replyToText: replyPayload?.replyToText ?? null,
      replyToFromId: replyPayload?.replyToFromId ?? null,
      replyToFromName: replyPayload?.replyToFromName ?? null,
    }, { specialType: "rps", specialAnimating: true });
    setMessages((prev) => {
      const next = [...prev, optimistic];
      setGroupChatMessagesCache(next);
      return next;
    });
    setShowEmojiPicker(false);
    requestAnimationFrame(() => flatRef.current?.scrollToEnd({ animated: true }));

    const totalSteps = 20;
    const finalIndex = Math.floor(Math.random() * variants.length);
    const spin = (step: number) => {
      if (step < totalSteps) {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: variants[step % variants.length] } : m)));
        setTimeout(() => spin(step + 1), 88);
      } else {
        const final = variants[finalIndex];
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: final, specialAnimating: false } : m)));
        void sendGroupChatMessage(final, replyPayload).then((msgRes) => {
          const msg = Array.isArray(msgRes) ? msgRes[msgRes.length - 1] : msgRes;
          if (msg) {
            setMessages((prev) => {
              const next = prev.map((m) => (m.id === id ? mapToLocalMsg({ ...msg, id: String(msg.id) }, { specialType: "rps" }) : m));
              setGroupChatMessagesCache(next);
              return next;
            });
          } else {
            setFailedIds((prev) => new Set(prev).add(id));
          }
        });
      }
    };
    spin(0);
  }, [currentUserId, user?.name, user?.profileImage, replyTo]);

  const handlePickEmoji = useCallback((emoji: string) => {
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
    setInputText((prev) => (prev || "") + emoji);
  }, [addToRecent, handleSendDice, handleSendRps]);

  const handleRetrySend = useCallback((item: LocalGroupMsg) => {
    const tempId = item.id;
    if (!tempId.startsWith("temp_")) return;
    const replyPayload = item.replyToText && item.replyToFromId && item.replyToFromName
      ? { replyToText: item.replyToText, replyToFromId: item.replyToFromId, replyToFromName: item.replyToFromName }
      : undefined;
    const textToSend = item.specialType === "dice" && item.diceValue != null
      ? `🎲 ${item.diceValue}`
      : item.specialType === "rps"
      ? item.text
      : item.text;
    const imgUrl = item.imageUrl ?? null;
    const giftAmt = item.specialType === "gift" ? (item.giftAmount ?? null) : null;
    doSendMessage(textToSend, tempId, replyPayload, imgUrl, giftAmt);
  }, [doSendMessage]);

  const handlePickImage = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const localUri = result.assets[0].uri;
      if (!localUri) return;

      const tempId = `temp_img_${Date.now()}`;
      const replyPayload = replyTo ? { replyToText: replyTo.replyToText, replyToFromId: replyTo.replyToFromId, replyToFromName: replyTo.replyToFromName } : undefined;
      const optimistic: GroupChatMessage = {
        id: tempId,
        fromId: currentUserId,
        fromName: user?.name || "مستخدم",
        fromProfileImage: user?.profileImage ?? null,
        text: "📷 صورة",
        createdAt: new Date().toISOString(),
        imageUrl: localUri,
        replyToText: replyPayload?.replyToText ?? null,
        replyToFromId: replyPayload?.replyToFromId ?? null,
        replyToFromName: replyPayload?.replyToFromName ?? null,
      };
      setMessages((prev) => {
        const next = [...prev, optimistic];
        setGroupChatMessagesCache(next);
        return next;
      });
      setReplyTo(null);
      requestAnimationFrame(() => flatRef.current?.scrollToEnd({ animated: true }));

      const uploaded = await uploadImageMessage(localUri);
      if (!uploaded) {
        setFailedIds((prev) => new Set(prev).add(tempId));
        return;
      }
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, imageUrl: uploaded.imageUrl } : m)));
      await doSendMessage("📷 صورة", tempId, replyPayload, uploaded.imageUrl);
    } catch {
      // ignore
    }
  }, [currentUserId, user?.name, user?.profileImage, replyTo, doSendMessage]);

  const handleScrollToBottom = useCallback(() => {
    flatRef.current?.scrollToEnd({ animated: true });
  }, []);

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
      setGoldBalance(w?.totalGold ?? 0);
      setChargedGold(w?.chargedGold ?? 0);
      setFreeGold(w?.freeGold ?? 0);
    });
  }, [showGiftModal]);

  const handleCloseGiftModal = useCallback(() => {
    setShowGiftModal(false);
    setShowEmojiPicker(false);
    setShowGiftRecipientBar(false);
    setGiftAllSelected(true);
    setGiftSelectedUserIds([]);
  }, []);

  const toggleGiftRecipient = useCallback((userId: string) => {
    if (giftAllSelected) {
      setGiftAllSelected(false);
      setGiftSelectedUserIds([userId]);
    } else {
      setGiftSelectedUserIds((prev) => {
        const idx = prev.indexOf(userId);
        const next = idx >= 0 ? prev.filter((_, i) => i !== idx) : [...prev, userId];
        if (next.length === 0) setGiftAllSelected(true);
        return next;
      });
    }
  }, [giftAllSelected]);

  const selectAllGiftRecipients = useCallback(() => {
    setGiftAllSelected(true);
    setGiftSelectedUserIds([]);
  }, []);

  const handleSendGift = useCallback(async () => {
    if (!currentUserId || selectedGiftIndex === null) {
      handleCloseGiftModal();
      return;
    }
    const giftKeys: ("peacock" | "dragon" | "space" | "love" | "bird" | "ghost" | "rose" | "flower")[] = ["peacock", "dragon", "space", "love", "bird", "ghost", "rose", "flower"];
    const giftKey = giftKeys[selectedGiftIndex] ?? "peacock";
    const baseAmount =
      giftKey === "peacock" ? 500
      : giftKey === "dragon" ? 100
      : giftKey === "space" ? 25
      : giftKey === "love" ? 10
      : giftKey === "bird" ? 45
      : giftKey === "ghost" ? 5
      : giftKey === "rose" ? 1
      : 200;
    const amount = baseAmount * Math.max(1, giftQuantity);

    const recipientIds = giftAllSelected ? [] : [...giftSelectedUserIds];
    const recipientCount = giftAllSelected ? 1 : Math.max(1, recipientIds.length);
    const totalCost = amount * recipientCount;

    if (goldBalance <= 0 || goldBalance < totalCost) {
      setShowGiftModal(false);
      setShowInsufficientBalanceModal(true);
      return;
    }

    const text = `GIFT:${giftKey}:${amount}`;
    const replyPayload = replyTo ? { replyToText: replyTo.replyToText, replyToFromId: replyTo.replyToFromId, replyToFromName: replyTo.replyToFromName } : undefined;
    setReplyTo(null);
    setShowGiftModal(false);
    setGiftOverlayType(giftKey);
    setShowGiftOverlay(true);
    requestAnimationFrame(() => flatRef.current?.scrollToEnd({ animated: true }));

    if (giftAllSelected || recipientIds.length === 0) {
      const tempId = `temp_gift_${Date.now()}`;
      const optimistic: LocalGroupMsg = mapToLocalMsg({
        id: tempId,
        fromId: currentUserId,
        fromName: user?.name || "مستخدم",
        fromProfileImage: user?.profileImage ?? null,
        text,
        createdAt: new Date().toISOString(),
        replyToText: replyPayload?.replyToText ?? null,
        replyToFromId: replyPayload?.replyToFromId ?? null,
        replyToFromName: replyPayload?.replyToFromName ?? null,
      }, { specialType: "gift", giftType: giftKey, giftAmount: amount });
      setMessages((prev) => {
        const next = [...prev, optimistic];
        setGroupChatMessagesCache(next);
        return next;
      });
      const msg = await sendGroupChatMessage(text, { ...replyPayload, giftAmount: amount });
      if (msg) {
        const msgs = Array.isArray(msg) ? msg : [msg];
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          const mapped = msgs.map((m) => mapToLocalMsg({ ...m, id: String(m.id) }));
          const next = [...withoutTemp, ...mapped];
          setGroupChatMessagesCache(next);
          return next;
        });
      } else {
        setFailedIds((prev) => new Set(prev).add(tempId));
      }
    } else {
      const baseTs = Date.now();
      const optimistics: LocalGroupMsg[] = recipientIds.map((toId, i) => {
        const recipient = roomUsers.find((u) => u.userId === toId);
        const tempId = `temp_gift_${baseTs}_${i}_${toId}`;
        return mapToLocalMsg(
          {
            id: tempId,
            fromId: currentUserId,
            fromName: user?.name || "مستخدم",
            fromProfileImage: user?.profileImage ?? null,
            text,
            createdAt: new Date().toISOString(),
            replyToText: replyPayload?.replyToText ?? null,
            replyToFromId: replyPayload?.replyToFromId ?? null,
            replyToFromName: replyPayload?.replyToFromName ?? null,
            toId,
          },
          { specialType: "gift", giftType: giftKey, giftAmount: amount, giftToName: recipient?.name, giftToProfileImage: recipient?.profileImage }
        );
      });
      setMessages((prev) => {
        const next = [...prev, ...optimistics];
        setGroupChatMessagesCache(next);
        return next;
      });
      for (let i = 0; i < recipientIds.length; i++) {
        const toId = recipientIds[i];
        const recipient = roomUsers.find((u) => u.userId === toId);
        const tempId = `temp_gift_${baseTs}_${i}_${toId}`;
        const msgRes = await sendGroupChatMessage(text, { ...replyPayload, giftAmount: amount, toId });
        const msg = Array.isArray(msgRes) ? msgRes[msgRes.length - 1] : msgRes;
        if (msg) {
          setMessages((prev) => {
            const existing = prev.find((m) => m.id === tempId) as LocalGroupMsg | undefined;
            const next = prev.map((m) =>
              m.id === tempId
                ? mapToLocalMsg(
                    { ...(msg as any), id: String((msg as any).id), toId },
                    { specialType: "gift", giftType: giftKey, giftAmount: amount, giftToName: existing?.giftToName ?? recipient?.name, giftToProfileImage: existing?.giftToProfileImage ?? recipient?.profileImage }
                  )
                : m
            );
            setGroupChatMessagesCache(next);
            return next;
          });
        } else {
          setFailedIds((prev) => new Set(prev).add(tempId));
        }
      }
    }
  }, [currentUserId, user?.name, user?.profileImage, replyTo, selectedGiftIndex, giftQuantity, goldBalance, handleCloseGiftModal, giftAllSelected, giftSelectedUserIds, roomUsers]);

  const avatarSize = expanded ? (SCREEN_WIDTH - 32 - AVATAR_GAP * (AVATAR_COLS + 1)) / AVATAR_COLS : 32;

  const onPlayGift = useCallback((giftType: string) => {
    setGiftOverlayType(giftType as typeof giftOverlayType);
    setShowGiftOverlay(true);
  }, []);

  const renderGroupItem = useCallback(
    ({ item }: { item: LocalGroupMsg }) => (
      <GroupChatMessageItem
        item={item}
        isMe={item.fromId === currentUserId}
        hasFailed={failedIdsRef.current.has(item.id)}
        diceFinalValuesRef={diceFinalValuesRef}
        onMention={handleMention}
        onDiceAnimEnd={handleDiceAnimEnd}
        onBubbleLongPress={handleBubbleLongPress}
        onRetry={handleRetrySend}
        onPreviewImage={setPreviewImage}
        onOpenProfile={onOpenProfile}
        onSendWelcome={sendWelcome}
        userIdToProfileImageMap={userIdToProfileImageMap}
        bubbleRefs={bubbleRefs}
        styles={styles}
        onPlayGift={onPlayGift}
      />
    ),
    [
      currentUserId,
      handleMention,
      handleDiceAnimEnd,
      handleBubbleLongPress,
      handleRetrySend,
      onOpenProfile,
      sendWelcome,
      userIdToProfileImageMap,
      onPlayGift,
    ]
  );

  if (showMusicPage) {
    return (
      <View style={[styles.container, { backgroundColor: BG_DARK }]}>
        <GroupChatMusicPage
          onBack={() => setShowMusicPage(false)}
          onSelect={async (uri, filename) => {
            setShowMusicPlayer(true);
            setShowMusicPage(false);
            setMusicUploading(true);
            setMusicImmediateState({
              url: uri,
              isPlaying: true,
              playlist: [uri],
              currentIndex: 0,
              volume: 1,
              updatedAt: Date.now(),
            });
            setMusicRefreshTrigger((t) => t + 1);
            try {
              const res = await uploadGroupChatMusic(uri, filename);
              if (res?.musicUrl) {
                const s = await groupChatMusicControl("play", { url: res.musicUrl });
                if (s) setMusicImmediateState({ ...s, updatedAt: Date.now() });
                else setMusicRefreshTrigger((t) => t + 1);
              }
            } finally {
              setMusicUploading(false);
              setMusicRefreshTrigger((t) => t + 1);
            }
          }}
        />
      </View>
    );
  }


  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: BG_DARK }]}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.5} hitSlop={4}>
            <Ionicons name="chatbubbles" size={18} color={TEXT_LIGHT} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.5} onPress={onOpenUsers} hitSlop={4}>
            <Ionicons name="person" size={18} color={TEXT_LIGHT} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>دردشه جماعيه</Text>
        <TouchableOpacity onPress={onBack} style={styles.headerSide} activeOpacity={0.5} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={TEXT_LIGHT} />
        </TouchableOpacity>
      </View>

      {joinToast ? (
        <Animated.View
          key={joinToast.key}
          pointerEvents="none"
          style={[
            styles.joinToastWrap,
            {
              opacity: joinToastAnim,
              transform: [{ translateX: joinToastX }],
            },
          ]}
        >
          <View style={styles.joinToastPill}>
            <Text style={styles.joinToastText} numberOfLines={1}>
              {joinToast.isMe ? "قادم " : "زائر قادم "}
              <Text style={styles.joinToastName}>{joinToast.name}</Text>
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.avatarsRow}>
        {expanded ? (
          <View style={styles.expandedGrid}>
            <View style={styles.gridRow}>
              {[1, 2, 3, 4].map((i) => {
                const isMySlot = mySlotIndex === i;
                const slotUser = voiceSlots[i - 1];
                const showAvatar = isMySlot ? user : slotUser;
                const isMe = isMySlot;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.avatarSmall, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, overflow: showAvatar ? "visible" : "hidden" }]}
                    activeOpacity={0.5}
                    onPress={() => setMySlotIndex(i)}
                  >
                    {showAvatar ? (
                      <AvatarWithWave size={avatarSize} isSpeaking={isMe ? isSpeaking : false} micPermissionGranted={micPermissionGranted} isMusicPlaying={isMe && musicIsPlaying} audioLevel={isMe ? (liveKitIsSpeaking ? Math.max(0.2, liveKitAudioLevel) : 0.2) : 0.5}>
                        <View style={[styles.avatarWithOverlay, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
                          <Image source={{ uri: getImageUrl(isMe ? user?.profileImage : (slotUser as GroupChatSlot)?.profileImage) }} style={[styles.avatarImage, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} resizeMode="cover" />
                          {isMe && micMuted && (
                            <View style={[styles.micMutedOverlay, { borderRadius: avatarSize / 2 }]}>
                              <Ionicons name="mic-off" size={avatarSize * 0.35} color="#fff" />
                            </View>
                          )}
                        </View>
                      </AvatarWithWave>
                    ) : (
                      <Ionicons name="add" size={avatarSize * 0.45} color={TEXT_LIGHT} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.gridRow}>
              {[5, 6, 7, 8].map((i) => {
                const isMySlot = mySlotIndex === i;
                const slotUser = voiceSlots[i - 1];
                const showAvatar = isMySlot ? user : slotUser;
                const isMe = isMySlot;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.avatarSmall, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, overflow: showAvatar ? "visible" : "hidden" }]}
                    activeOpacity={0.5}
                    onPress={() => setMySlotIndex(i)}
                  >
                    {showAvatar ? (
                      <AvatarWithWave size={avatarSize} isSpeaking={isMe ? isSpeaking : false} micPermissionGranted={micPermissionGranted} isMusicPlaying={isMe && musicIsPlaying} audioLevel={isMe ? (liveKitIsSpeaking ? Math.max(0.2, liveKitAudioLevel) : 0.2) : 0.5}>
                        <View style={[styles.avatarWithOverlay, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
                          <Image source={{ uri: getImageUrl(isMe ? user?.profileImage : (slotUser as GroupChatSlot)?.profileImage) }} style={[styles.avatarImage, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} resizeMode="cover" />
                          {isMe && micMuted && (
                            <View style={[styles.micMutedOverlay, { borderRadius: avatarSize / 2 }]}>
                              <Ionicons name="mic-off" size={avatarSize * 0.35} color="#fff" />
                            </View>
                          )}
                        </View>
                      </AvatarWithWave>
                    ) : (
                      <Ionicons name="add" size={avatarSize * 0.45} color={TEXT_LIGHT} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.controlBar}>
              <TouchableOpacity style={styles.arrowUpCircle} activeOpacity={0.5} onPress={() => setExpanded(false)}>
                <Ionicons name="chevron-up" size={16} color={TEXT_LIGHT} />
              </TouchableOpacity>
              <View style={styles.controlBarRight}>
                {mySlotIndex != null && (
                  <TouchableOpacity
                    style={styles.controlIcon}
                    activeOpacity={0.5}
                    onPress={() => setShowMusicPage(true)}
                  >
                    <Ionicons name="musical-notes-outline" size={16} color={TEXT_LIGHT} />
                  </TouchableOpacity>
                )}
                {mySlotIndex != null && (
                  <TouchableOpacity
                    style={styles.controlIcon}
                    activeOpacity={0.5}
                    onPress={() => setShowLudo(true)}
                  >
                    <Ionicons name="dice-outline" size={16} color={TEXT_LIGHT} />
                  </TouchableOpacity>
                )}
                {mySlotIndex != null && (
                  <TouchableOpacity
                      style={styles.controlIcon}
                      activeOpacity={0.5}
                      onPress={() => {
                        const next = !micMuted;
                        setMicMuted(next);
                        setLiveKitMicrophoneEnabled(!next);
                      }}
                    >
                      <Ionicons
                        name={micMuted ? "mic-off-outline" : "mic-outline"}
                        size={16}
                        color={micMuted ? "#ef4444" : TEXT_LIGHT}
                      />
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.controlIcon}
                  activeOpacity={0.5}
                  onPress={() => {
                    const next = !speakerMuted;
                    setSpeakerMuted(next);
                    setLiveKitSpeakerMute(next);
                  }}
                >
                  <Ionicons
                    name={speakerMuted ? "volume-mute-outline" : "volume-high-outline"}
                    size={16}
                    color={speakerMuted ? "#ef4444" : TEXT_LIGHT}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlIcon} activeOpacity={0.5}>
                  <Ionicons name="paw-outline" size={16} color="#a78bfa" />
                </TouchableOpacity>
                {mySlotIndex != null && (
                  <TouchableOpacity
                    style={styles.hangUpBtn}
                    activeOpacity={0.5}
                    onPress={() => {
                      setMySlotIndex(null);
                      setMicMuted(false);
                      setSpeakerMuted(false);
                    }}
                  >
                    <Ionicons name="call" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarsScroll}>
            <View style={styles.addWithArrow}>
              <TouchableOpacity style={styles.arrowBtn} activeOpacity={0.5} onPress={() => setExpanded(true)} hitSlop={8}>
                <Ionicons name="chevron-down" size={18} color={TEXT_LIGHT} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.avatarSmall, (mySlotIndex === 1 ? user : voiceSlots[0]) ? { overflow: "visible" as const } : undefined]} activeOpacity={0.5} onPress={() => setMySlotIndex(1)}>
                {(mySlotIndex === 1 ? user : voiceSlots[0]) ? (
                  <AvatarWithWave size={32} isSpeaking={mySlotIndex === 1 ? isSpeaking : false} micPermissionGranted={micPermissionGranted} isMusicPlaying={mySlotIndex === 1 && musicIsPlaying} audioLevel={mySlotIndex === 1 ? (liveKitIsSpeaking ? Math.max(0.2, liveKitAudioLevel) : 0.2) : 0.5}>
                    <View style={styles.avatarWithOverlay}>
                      <Image source={{ uri: getImageUrl(mySlotIndex === 1 ? user?.profileImage : (voiceSlots[0] as GroupChatSlot)?.profileImage) }} style={styles.avatarImageSmall} resizeMode="cover" />
                      {mySlotIndex === 1 && micMuted && (
                        <View style={styles.micMutedOverlay}>
                          <Ionicons name="mic-off" size={12} color="#fff" />
                        </View>
                      )}
                    </View>
                  </AvatarWithWave>
                ) : (
                  <Ionicons name="add" size={16} color={TEXT_LIGHT} />
                )}
              </TouchableOpacity>
            </View>
            {[2, 3, 4, 5, 6, 7, 8].map((i) => {
              const isMySlot = mySlotIndex === i;
              const slotUser = voiceSlots[i - 1];
              const showAvatar = isMySlot ? user : slotUser;
              const isMe = isMySlot;
              return (
                <TouchableOpacity key={i} style={[styles.avatarSmall, showAvatar ? { overflow: "visible" as const } : undefined]} activeOpacity={0.5} onPress={() => setMySlotIndex(i)}>
                  {showAvatar ? (
                    <AvatarWithWave size={32} isSpeaking={isMe ? isSpeaking : false} micPermissionGranted={micPermissionGranted} isMusicPlaying={isMe && musicIsPlaying} audioLevel={isMe ? (liveKitIsSpeaking ? Math.max(0.2, liveKitAudioLevel) : 0.2) : 0.5}>
                      <View style={styles.avatarWithOverlay}>
                        <Image source={{ uri: getImageUrl(isMe ? user?.profileImage : (slotUser as GroupChatSlot)?.profileImage) }} style={styles.avatarImageSmall} resizeMode="cover" />
                        {isMe && micMuted && (
                          <View style={styles.micMutedOverlay}>
                            <Ionicons name="mic-off" size={12} color="#fff" />
                          </View>
                        )}
                      </View>
                    </AvatarWithWave>
                  ) : (
                    <Ionicons name="add" size={16} color={TEXT_LIGHT} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
      <View style={styles.content}>
        {loading && messages.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            keyboardShouldPersistTaps="handled"
            data={messages}
            extraData={failedIdsExtra}
            removeClippedSubviews={Platform.OS === "android"}
            maxToRenderPerBatch={12}
            windowSize={10}
            initialNumToRender={12}
            updateCellsBatchingPeriod={100}
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            onContentSizeChange={() => {
              if (messages.length > 0 && !initialScrollDone.current) {
                initialScrollDone.current = true;
                setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 20);
              }
            }}
            renderItem={renderGroupItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={48} color={TEXT_MUTED} />
                <Text style={styles.emptyText}>لا توجد رسائل بعد. ابدأ المحادثة!</Text>
              </View>
            }
          />
        )}
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
      {showGiftModal && (
        <Modal visible transparent animationType="slide" onRequestClose={handleCloseGiftModal}>
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
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={TEXT_MUTED} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                    <View style={styles.giftModalIcons}>
                      <TouchableOpacity style={[styles.giftHeaderIcon, styles.giftHeaderIconActive]}>
                        <Ionicons name="gift" size={16} color="#fbbf24" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {showGiftRecipientBar && (
                    <View style={styles.giftRecipientBar}>
                      <TouchableOpacity
                        style={styles.giftRecipientBarAllRow}
                        activeOpacity={0.7}
                        onPress={selectAllGiftRecipients}
                      >
                        <Text style={styles.giftRecipientBarAll}>All</Text>
                        {giftAllSelected && (
                          <Ionicons name="checkmark-circle" size={14} color="#22c55e" style={styles.giftRecipientBarCheck} />
                        )}
                      </TouchableOpacity>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.giftRecipientBarScroll}>
                        {roomUsers.filter((u) => u.userId !== currentUserId).map((u) => {
                          const isSelected = !giftAllSelected && giftSelectedUserIds.includes(u.userId);
                          const isOnMic =
                            (mySlotIndex != null && u.userId === currentUserId) ||
                            giftSlots.some((s) => s != null && ((s as { userId?: string; id?: string }).userId === u.userId || (s as { userId?: string; id?: string }).id === u.userId));
                          return (
                            <TouchableOpacity
                              key={u.userId}
                              style={styles.giftRecipientBarItem}
                              activeOpacity={0.7}
                              onPress={() => toggleGiftRecipient(u.userId)}
                            >
                              {isSelected && (
                                <View style={styles.giftRecipientBarCheckBadge}>
                                  <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
                                </View>
                              )}
                              <View style={styles.giftRecipientBarAvatarWrap}>
                                {u.profileImage ? (
                                  <Image source={{ uri: getImageUrl(u.profileImage) }} style={styles.giftRecipientBarAvatar} />
                                ) : (
                                  <View style={[styles.giftRecipientBarAvatar, styles.giftRecipientBarAvatarPlaceholder]}>
                                    <Ionicons name="person" size={12} color={TEXT_MUTED} />
                                  </View>
                                )}
                                {isOnMic && (
                                  <View style={styles.giftRecipientBarMicBadge}>
                                    <Ionicons name="mic" size={8} color="#fff" />
                                  </View>
                                )}
                              </View>
                              <Text style={styles.giftRecipientBarName} numberOfLines={1}>{u.name || "مستخدم"}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
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
                      <Ionicons name="gift-outline" size={14} color={TEXT_LIGHT} />
                      <Text style={styles.giftQuantityText}>{giftQuantity}</Text>
                      <TouchableOpacity onPress={() => setGiftQuantity((q) => Math.min(q + 1, 99))} hitSlop={6}>
                        <Ionicons name="chevron-up" size={14} color={TEXT_LIGHT} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setGiftQuantity((q) => Math.max(1, q - 1))} hitSlop={6}>
                        <Ionicons name="chevron-down" size={14} color={TEXT_LIGHT} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.giftSendRow}>
                      <TouchableOpacity
                        style={[styles.giftArrowBtn, showGiftRecipientBar && styles.giftArrowBtnActive]}
                        activeOpacity={0.6}
                        onPress={() => {
                          if (showGiftRecipientBar) {
                            setGiftAllSelected(true);
                            setGiftSelectedUserIds([]);
                          }
                          setShowGiftRecipientBar((v) => !v);
                        }}
                      >
                        <Ionicons name="chevron-down" size={16} color={TEXT_LIGHT} />
                      </TouchableOpacity>
                      <View style={styles.giftAllTextRow}>
                        <Text style={styles.giftAllText}>all</Text>
                        {giftAllSelected && (
                          <Ionicons name="checkmark-circle" size={14} color="#22c55e" style={{ marginRight: 3 }} />
                        )}
                      </View>
                      <TouchableOpacity style={styles.giftSendBtn} onPress={handleSendGift} activeOpacity={0.5}>
                        <Text style={styles.giftSendText}>إرسال</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
      {showInsufficientBalanceModal && (
        <Modal visible transparent animationType="fade">
          <View style={styles.bonusModalOverlay}>
            <TouchableOpacity style={styles.bonusModalBackdrop} activeOpacity={1} onPress={() => setShowInsufficientBalanceModal(false)} />
            <View style={styles.bonusModalCard}>
              <Text style={styles.bonusModalEmoji}>⚠️</Text>
              <Text style={styles.bonusModalTitle}>رصيد غير كافٍ</Text>
              <Text style={styles.bonusModalText}>رصيدك من الذهب غير كافٍ لإرسال الهدية</Text>
              <View style={styles.bonusModalBtnsRow}>
                <TouchableOpacity
                  style={[styles.bonusModalBtn, styles.bonusModalBtnPrimary]}
                  onPress={() => {
                    setShowInsufficientBalanceModal(false);
                    onOpenTopup?.();
                  }}
                  activeOpacity={0.5}
                >
                  <Text style={[styles.bonusModalBtnText, styles.bonusModalBtnPrimaryText]}>اذهب لشحن رصيد</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bonusModalBtn} onPress={() => setShowInsufficientBalanceModal(false)} activeOpacity={0.5}>
                  <Text style={styles.bonusModalBtnText}>حسناً</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      <Modal visible={!!bubbleMenu} transparent animationType="fade">
        <Pressable style={styles.bubbleMenuOverlay} onPress={() => setBubbleMenu(null)}>
          {bubbleMenu && (
            <TouchableOpacity
              style={[
                styles.bubbleMenuCardFloating,
                {
                  left: Math.max(8, Math.min(bubbleMenu.x + bubbleMenu.w / 2 - (bubbleMenu.isMe ? 68 : 52), SCREEN_WIDTH - (bubbleMenu.isMe ? 136 : 112))),
                  top: Math.max(8, bubbleMenu.y - 48),
                },
              ]}
              activeOpacity={1}
              onPress={() => {}}
            >
              {bubbleMenu.isMe ? (
                <>
                  <TouchableOpacity style={styles.bubbleMenuBtnFloating} onPress={handleDeleteFromMenu} activeOpacity={0.5}>
                    <Ionicons name="trash-outline" size={14} color={TEXT_LIGHT} />
                    <Text style={styles.bubbleMenuBtnTextFloating}>سحب</Text>
                  </TouchableOpacity>
                  <View style={styles.bubbleMenuDividerFloating} />
                </>
              ) : null}
              <TouchableOpacity style={styles.bubbleMenuBtnFloating} onPress={handleReplyFromMenu} activeOpacity={0.5}>
                <Ionicons name="arrow-undo" size={14} color={TEXT_LIGHT} />
                <Text style={styles.bubbleMenuBtnTextFloating}>رد</Text>
              </TouchableOpacity>
              <View style={styles.bubbleMenuDividerFloating} />
              <TouchableOpacity style={styles.bubbleMenuBtnFloating} onPress={handleCopyFromMenu} activeOpacity={0.5}>
                <Ionicons name="copy-outline" size={14} color={TEXT_LIGHT} />
                <Text style={styles.bubbleMenuBtnTextFloating}>نسخ</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </Pressable>
      </Modal>

      <GroupChatMusicPlayer
        visible={showMusicPlayer}
        onClose={() => setShowMusicPlayer(false)}
        onExpand={() => setShowMusicPlayer(true)}
        refreshTrigger={musicRefreshTrigger}
        immediateState={musicImmediateState}
        onImmediateStateConsumed={() => setMusicImmediateState(null)}
        uploading={musicUploading}
        canControl={mySlotIndex != null}
        onStateChange={(s) => setMusicIsPlaying(!!s?.isPlaying)}
      />

      <LudoGameModal
        visible={showLudo}
        onClose={() => setShowLudo(false)}
        me={{
          id: currentUserId,
          name: user?.name || "مستخدم",
          profileImage: user?.profileImage ? getImageUrl(user.profileImage) : null,
        }}
        candidates={roomUsers.map((u) => ({ id: u.userId, name: u.name, profileImage: getImageUrl(u.profileImage || null) }))}
        sessionId="group-chat-room"
      />

      {replyTo ? (
        <View style={styles.replyPreviewRow}>
          <TouchableOpacity
            style={styles.replyPreview}
            onPress={() => setReplyTo(null)}
            activeOpacity={0.5}
          >
            <View style={styles.replyPreviewContent}>
              <Text style={styles.replyPreviewLabel}>رد على {replyTo.replyToFromName}</Text>
              <Text style={styles.replyPreviewText} numberOfLines={2}>{replyTo.replyToText}</Text>
            </View>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={[styles.inputRow, (keyboardVisible || showEmojiPicker) && styles.inputRowKeyboardUp]}>
        <View style={styles.inputIconsRow}>
          <TouchableOpacity
            style={styles.emojiIconBtn}
            activeOpacity={0.5}
            hitSlop={4}
            onPress={handlePickImage}
          >
            <Ionicons name="image-outline" size={22} color={TEXT_LIGHT} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.emojiIconBtn}
            activeOpacity={0.5}
            hitSlop={4}
            onPress={() => {
              if (showEmojiPicker) {
                setShowEmojiPicker(false);
              } else {
                Keyboard.dismiss();
                setShowEmojiPicker(true);
              }
            }}
          >
            <Ionicons name="happy-outline" size={22} color={showEmojiPicker ? ACCENT : TEXT_LIGHT} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.5} hitSlop={4}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.emojiIconBtn} activeOpacity={0.5} hitSlop={4} onPress={handleScrollToBottom}>
            <Ionicons name="chevron-down" size={20} color={TEXT_LIGHT} />
          </TouchableOpacity>
        </View>
        <Pressable
          style={styles.inputWrap}
          onPressIn={() => {
            if (showEmojiPicker) {
              setShowEmojiPicker(false);
              setTimeout(() => inputRef.current?.focus(), 30);
            } else {
              inputRef.current?.focus();
            }
          }}
        >
          {mentionPrefix ? (
            <TouchableOpacity onPress={() => { setMentionPrefix(null); setMentionData(null); }} activeOpacity={0.5}>
              <Text style={styles.mentionText}>{mentionPrefix}</Text>
            </TouchableOpacity>
          ) : null}
          <TextInput
            ref={inputRef}
            style={[styles.input, mentionPrefix ? styles.inputWithMention : null]}
            placeholder={mentionPrefix ? "" : "اكتب رسالة..."}
            placeholderTextColor={TEXT_MUTED}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit={false}
            onFocus={() => setShowEmojiPicker(false)}
          />
        </Pressable>
        <TouchableOpacity style={styles.emojiIconBtn} activeOpacity={0.5} hitSlop={4} onPress={handleOpenGiftModal}>
          <LottieView source={giftBoxAnim} autoPlay loop style={styles.giftIconAnim} />
        </TouchableOpacity>
      </View>
      {showEmojiPicker && (
        <View style={styles.emojiPanel}>
          <View style={styles.emojiSection}>
            <Text style={styles.emojiSectionLabel}>الأحدث</Text>
            <View style={styles.emojiRow}>
              {recentEmojis.map((emoji, i) => (
                <TouchableOpacity
                  key={`recent-${i}-${emoji}`}
                  style={styles.emojiCharBtn}
                  activeOpacity={0.5}
                  onPress={() => handlePickEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.emojiSection}>
            <Text style={styles.emojiSectionLabel}>الكل</Text>
            <ScrollView style={styles.emojiScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {EMOJI_ROWS.map((row, idx) => (
                <View key={idx} style={styles.emojiRow}>
                  {row.map((emoji, colIdx) => (
                    <TouchableOpacity
                      key={`${idx}-${colIdx}`}
                      style={styles.emojiCharBtn}
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
              style={[styles.emojiActionBtn, !inputText.trim() && styles.emojiActionBtnDisabled]}
              onPress={() => inputText.trim() && handleSend()}
              activeOpacity={0.5}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={20} color={inputText.trim() ? ACCENT : TEXT_MUTED} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emojiActionBtn}
              onPress={() => setInputText((prev) => prev.slice(0, -1))}
              activeOpacity={0.5}
            >
              <Ionicons name="backspace-outline" size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === "ios" ? 44 : 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerSide: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_LIGHT,
    textAlign: "center",
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarsRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  avatarsScroll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  addWithArrow: {
    flexDirection: "row",
    alignItems: "center",

    gap: 2,
    marginLeft:-10
  },
  arrowBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  expandedGrid: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 8,
  },
  controlBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  controlIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  hangUpBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  arrowUpCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(167, 139, 250, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 74,
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: AVATAR_GAP,
    marginBottom: AVATAR_GAP,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(167, 139, 250, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(167, 139, 250, 0.35)",
    overflow: "hidden",
  },
  avatarImage: {},
  avatarImageSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarWithOverlay: {
    position: "relative",
    width: 32,
    height: 32,
    overflow: "hidden",
  },
  micMutedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 10, paddingBottom: 24 },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: TEXT_MUTED },
  msgRow: { flexDirection: "column", marginBottom: 14, alignItems: "flex-start" },
  msgRowMe: { alignItems: "flex-end" },
  joinAnnouncementRow: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  joinAnnouncementPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(167, 139, 250, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.4)",
  },
  joinAnnouncementText: {
    fontSize: 13,
    color: TEXT_LIGHT,
    textAlign: "center",
    writingDirection: "rtl",
  },
  joinAnnouncementHighlight: {
    color: "#38bdf8",
    fontWeight: "700",
  },
  joinToastWrap: {
    position: "absolute",
    top: 64,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  joinToastPill: {
    maxWidth: "92%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.35)",
  },
  joinToastText: {
    fontSize: 14,
    color: TEXT_LIGHT,
    textAlign: "center",
    writingDirection: "rtl",
  },
  joinToastName: {
    color: "#38bdf8",
    fontWeight: "700",
  },
  msgSenderCol: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
    maxWidth: BUBBLE_WIDTH,
  },
  msgSenderColMe: {
    alignItems: "flex-end",
  },
  msgImageNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  msgNameGemsCol: {
    flexDirection: "column",
    gap: 4,
  },
  msgAvatarSquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(167, 139, 250, 0.15)",
  },
  placeholderAvatar: { alignItems: "center", justifyContent: "center" },
  msgSenderName: {
    fontSize: 11,
    color: TEXT_LIGHT,
    maxWidth: 80,
  },
  msgGemsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  msgGemItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  msgGemCount: {
    fontSize: 9,
    color: TEXT_MUTED,
  },
  msgBubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  msgBubbleRowMe: {
    alignSelf: "flex-end",
  },
  msgFailedBtn: { marginBottom: 4, padding: 4 },
  msgBubble: {
    alignSelf: "flex-start",
    maxWidth: BUBBLE_WIDTH,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  msgBubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: ACCENT,
    borderColor: "rgba(167, 139, 250, 0.5)",
  },
  msgReplyBox: {
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "rgba(0,0,0,0.2)",
  },
  msgReplyBoxMe: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderLeftColor: "rgba(255,255,255,0.5)",
  },
  msgReplyLabel: { fontSize: 10, color: "rgba(0,0,0,0.5)", marginBottom: 2 },
  msgReplyLabelMe: { color: "rgba(255,255,255,0.8)" },
  msgReplyText: { fontSize: 12, color: "#374151" },
  msgReplyTextMe: { color: "rgba(255,255,255,0.95)" },
  msgName: { fontSize: 11, color: ACCENT, marginBottom: 2 },
  msgText: { fontSize: 13, lineHeight: 19 },
  msgTextMe: { color: "#ffffff" },
  msgTextOther: { color: "#1f2937" },
  msgTime: { fontSize: 10, marginTop: 4 },
  msgTimeMe: { color: "rgba(255,255,255,0.85)" },
  msgTimeOther: { color: "rgba(0,0,0,0.5)" },
  msgImageBubble: {
    width: 180,
    height: 200,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.6)",
    marginBottom: 4,
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
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    paddingBottom: 0,
  },
  giftModal: {
    backgroundColor: "#1e1b2e",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    marginBottom: 60,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  giftModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  giftGoldPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(251,191,36,0.2)",
  },
  giftGoldPillContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  giftGoldText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fbbf24",
  },
  giftModalIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  giftHeaderIcon: {
    padding: 4,
  },
  giftHeaderIconActive: {
    opacity: 1,
  },
  giftGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: SCREEN_WIDTH - 28,
  },
  giftItem: {
    width: (SCREEN_WIDTH - 28 - 18) / 4,
    alignItems: "center",
    marginBottom: 10,
  },
  giftItemSelected: {
    borderWidth: 2,
    borderColor: "#a855f7",
    borderRadius: 8,
    padding: 2,
    margin: -2,
  },
  giftItemImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(148,163,184,0.2)",
    marginBottom: 4,
  },
  giftItemName: {
    fontSize: 10,
    color: TEXT_LIGHT,
    marginBottom: 2,
    width: "100%",
    textAlign: "center",
  },
  giftItemCostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  giftItemCost: {
    fontSize: 10,
    color: "#fbbf24",
    fontWeight: "600",
  },
  giftPagination: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    marginVertical: 6,
  },
  giftDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(148,163,184,0.4)",
  },
  giftDotActive: {
    backgroundColor: "#e2e8f0",
  },
  giftModalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  giftQuantityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.15)",
  },
  giftQuantityText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_LIGHT,
  },
  giftSendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  giftArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(148,163,184,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  giftArrowBtnActive: {
    backgroundColor: "rgba(148,163,184,0.35)",
  },
  giftRecipientBar: {
    marginTop: 4,
    marginBottom: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(148,163,184,0.15)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
  },
  giftRecipientBarAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  giftRecipientBarAll: {
    fontSize: 11,
    fontWeight: "700",
    color: TEXT_LIGHT,
  },
  giftRecipientBarCheck: {
    marginLeft: 2,
  },
  giftRecipientBarCheckBadge: {
    position: "absolute",
    top: -2,
    right: 8,
    zIndex: 1,
  },
  giftRecipientBarScroll: {
    flexDirection: "row",
    gap: 12,
    paddingRight: 4,
  },
  giftRecipientBarItem: {
    alignItems: "center",
    width: 40,
  },
  giftRecipientBarAvatarWrap: {
    position: "relative",
    marginBottom: 2,
  },
  giftRecipientBarAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  giftRecipientBarMicBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  giftRecipientBarAvatarPlaceholder: {
    backgroundColor: "rgba(148,163,184,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  giftRecipientBarName: {
    fontSize: 9,
    color: TEXT_LIGHT,
    width: 40,
    textAlign: "center",
  },
  giftSelectedDrawer: {
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(168,85,247,0.12)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  giftSelectedDrawerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 8,
  },
  giftSelectedDrawerScroll: {
    flexDirection: "row",
    gap: 12,
    paddingRight: 4,
  },
  giftSelectedDrawerItem: {
    alignItems: "center",
    width: 52,
  },
  giftSelectedDrawerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 4,
  },
  giftSelectedDrawerAvatarPlaceholder: {
    backgroundColor: "rgba(148,163,184,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  giftSelectedDrawerName: {
    fontSize: 11,
    fontWeight: "600",
    color: TEXT_LIGHT,
    width: 52,
    textAlign: "center",
  },
  giftAllTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  giftAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
  giftSendBtn: {
    flex: 1,
    backgroundColor: ACCENT,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  giftSendText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  goldCoinIcon: {
    fontSize: 12,
    marginRight: 1,
  },
  giftCardBubble: {
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#d9c7ff",
    gap: 0,
    maxWidth: BUBBLE_WIDTH,
    minWidth: BUBBLE_WIDTH * 0.7,
    alignSelf: "flex-start",
  },
  giftCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  giftCardRowWithTo: {
    marginTop: 0,
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
  giftCardToRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignSelf: "center",
    marginBottom: 6,
  },
  giftCardToAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(51,34,92,0.2)",
  },
  giftCardToAvatarPlaceholder: {
    backgroundColor: "rgba(107,86,127,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(51,34,92,0.15)",
  },
  giftCardToText: {
    fontSize: 14,
    color: "#33225c",
    fontWeight: "700",
    textAlign: "center",
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
  giftCardAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fbbf24",
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
  bonusModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bonusModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  bonusModalCard: {
    backgroundColor: "#1e1b2e",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginHorizontal: 24,
    maxWidth: 320,
  },
  bonusModalEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  bonusModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 8,
  },
  bonusModalText: {
    fontSize: 16,
    color: TEXT_MUTED,
    marginBottom: 20,
  },
  bonusModalBtnsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  bonusModalBtn: {
    flex: 1,
    backgroundColor: "rgba(148,163,184,0.2)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  bonusModalBtnPrimary: {
    backgroundColor: "#fbbf24",
  },
  bonusModalBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  bonusModalBtnPrimaryText: {
    color: "#1f2937",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    paddingBottom: Platform.OS === "ios" ? 24 : 40,
    paddingTop: 10,
    marginBottom: Platform.OS === "ios" ? 24 : 20,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: BG_DARK,
  },
  inputRowKeyboardUp: {
    paddingBottom: 8,
    marginBottom: 0,
  },
  bubbleMenuOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  bubbleMenuCardFloating: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.82)",
    borderRadius: 10,
    paddingHorizontal: 2,
    paddingVertical: 4,
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  bubbleMenuBtnFloating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bubbleMenuBtnTextFloating: { fontSize: 12, color: TEXT_LIGHT, fontWeight: "600" },
  bubbleMenuDividerFloating: { width: 1, height: 16, backgroundColor: "rgba(255,255,255,0.35)" },
  replyPreviewRow: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: BG_DARK,
  },
  replyPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyPreviewContent: { flex: 1 },
  replyPreviewLabel: { fontSize: 11, color: "rgba(255,255,255,0.8)", marginBottom: 2 },
  replyPreviewText: { fontSize: 12, color: TEXT_LIGHT },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  mentionText: {
    fontSize: 14,
    color: MENTION_COLOR,
    marginRight: 4,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 14,
    color: TEXT_LIGHT,
  },
  inputWithMention: {
    minWidth: 60,
  },
  inputIconsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  emojiIconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  giftIconAnim: {
    width: 32,
    height: 32,
  },
  emojiPanel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 10,
    marginBottom: Platform.OS === "ios" ? 42 : 38,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.98)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)",
    gap: 4,
    maxHeight: 280,
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
  emojiCharBtn: {
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
  specialNoBubble: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  specialBubbleCenter: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  diceLottie: {
    width: 38,
    height: 38,
  },
  diceImage: {
    width: 26,
    height: 28,
  },
  rpsEmoji: {
    fontSize: 24,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
});