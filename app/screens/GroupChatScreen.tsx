import React, { useEffect, useState } from "react";
import { StyleSheet, View, TouchableOpacity, Platform, Text, ScrollView, Dimensions, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { joinGroupChat, leaveGroupChat } from "../../utils/messagesApi";
import { API_BASE_URL } from "../../utils/authHelper";

function getImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/uploads/${url.replace(/^\//, "")}`;
}

const BG_DARK = "#1a1625";
const TEXT_LIGHT = "#f5f3ff";

type UserInfo = { id?: string; name?: string; profileImage?: string };
type Props = {
  user: UserInfo | null;
  selectedSlot?: string | null;
  onSelectedSlotChange?: (userId: string | null) => void;
  onBack: () => void;
  onOpenTopup?: () => void;
  onOpenUsers?: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AVATAR_COLS = 4;
const AVATAR_GAP = 10;
export default function GroupChatScreen({ user, onBack, onOpenUsers }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mySlotIndex, setMySlotIndex] = useState<number | null>(null);

  useEffect(() => {
    joinGroupChat().catch(() => {});
    return () => {
      void leaveGroupChat().catch(() => {});
    };
  }, []);

  const avatarSize = expanded ? (SCREEN_WIDTH - 32 - AVATAR_GAP * (AVATAR_COLS + 1)) / AVATAR_COLS : 32;

  return (
    <View style={[styles.container, { backgroundColor: BG_DARK }]}>
      <View style={styles.header}>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.8}>
            <Ionicons name="chatbubbles" size={18} color={TEXT_LIGHT} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.8} onPress={onOpenUsers}>
            <Ionicons name="person" size={18} color={TEXT_LIGHT} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>دردشه جماعيه</Text>
        <TouchableOpacity onPress={onBack} style={styles.headerSide} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color={TEXT_LIGHT} />
        </TouchableOpacity>
      </View>
      <View style={styles.avatarsRow}>
        {expanded ? (
          <View style={styles.expandedGrid}>
            <View style={styles.gridRow}>
              {[1, 2, 3, 4].map((i) => {
                const isMySlot = mySlotIndex === i;
                const showMyPhoto = isMySlot && user?.profileImage;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.avatarSmall, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, overflow: "hidden" }]}
                    activeOpacity={0.8}
                    onPress={() => setMySlotIndex(i)}
                  >
                    {showMyPhoto ? (
                      <Image source={{ uri: getImageUrl(user.profileImage) }} style={[styles.avatarImage, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} resizeMode="cover" />
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
                const showMyPhoto = isMySlot && user?.profileImage;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.avatarSmall, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, overflow: "hidden" }]}
                    activeOpacity={0.8}
                    onPress={() => setMySlotIndex(i)}
                  >
                    {showMyPhoto ? (
                      <Image source={{ uri: getImageUrl(user.profileImage) }} style={[styles.avatarImage, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} resizeMode="cover" />
                    ) : (
                      <Ionicons name="add" size={avatarSize * 0.45} color={TEXT_LIGHT} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.controlBar}>
              <TouchableOpacity style={styles.arrowUpCircle} activeOpacity={0.8} onPress={() => setExpanded(false)}>
                <Ionicons name="chevron-up" size={16} color={TEXT_LIGHT} />
              </TouchableOpacity>
              <View style={styles.controlBarRight}>
                {mySlotIndex != null && (
                  <>
                    <TouchableOpacity style={styles.controlIcon} activeOpacity={0.8}>
                      <Ionicons name="musical-notes-outline" size={16} color={TEXT_LIGHT} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.controlIcon} activeOpacity={0.8}>
                      <Ionicons name="mic-off-outline" size={16} color={TEXT_LIGHT} />
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity style={styles.controlIcon} activeOpacity={0.8}>
                  <Ionicons name="volume-high-outline" size={16} color={TEXT_LIGHT} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlIcon} activeOpacity={0.8}>
                  <Ionicons name="paw-outline" size={16} color="#a78bfa" />
                </TouchableOpacity>
                {mySlotIndex != null && (
                  <TouchableOpacity style={styles.hangUpBtn} activeOpacity={0.8} onPress={() => setMySlotIndex(null)}>
                    <Ionicons name="call" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarsScroll}>
            <View style={styles.addWithArrow}>
              <TouchableOpacity style={styles.arrowBtn} activeOpacity={0.8} onPress={() => setExpanded(true)}>
                <Ionicons name="chevron-down" size={18} color={TEXT_LIGHT} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatarSmall} activeOpacity={0.8} onPress={() => setMySlotIndex(1)}>
                {mySlotIndex === 1 && user?.profileImage ? (
                  <Image source={{ uri: getImageUrl(user.profileImage) }} style={styles.avatarImageSmall} resizeMode="cover" />
                ) : (
                  <Ionicons name="add" size={16} color={TEXT_LIGHT} />
                )}
              </TouchableOpacity>
            </View>
            {[2, 3, 4, 5, 6, 7, 8].map((i) => {
              const isMySlot = mySlotIndex === i;
              const showMyPhoto = isMySlot && user?.profileImage;
              return (
                <TouchableOpacity key={i} style={styles.avatarSmall} activeOpacity={0.8} onPress={() => setMySlotIndex(i)}>
                  {showMyPhoto ? (
                    <Image source={{ uri: getImageUrl(user.profileImage) }} style={styles.avatarImageSmall} resizeMode="cover" />
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
        {/* سنبني المحتوى خطوة بخطوة */}
      </View>
    </View>
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
  content: { flex: 1 },
});
