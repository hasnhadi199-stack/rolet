import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  FlatList,
  Modal,
  Dimensions,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import * as VideoThumbnails from "expo-video-thumbnails";
import {
  fetchMoments,
  createMoment,
  toggleMomentLike,
  deleteMoment,
  fetchMyMomentLikers,
  type Moment,
  type MomentLiker,
} from "../../utils/momentsApi";
import { getFlagEmoji, getCountryName } from "../../utils/countries";
import { useAppAlert } from "../components/AppAlertProvider";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLS = 2;
const GAP = 10;

const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const ACCENT_SOFT = "#c4b5fd";
const CARD_BG = "rgba(45, 38, 64, 0.8)";
const PURPLE_DARK = "#1a1625";
const MAX_VIDEO_SEC = 20;
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
  android: { elevation: 4 },
});

function formatRelativeTime(input: string | Date | null | undefined): string {
  if (!input) return "";
  const date = typeof input === "string" ? new Date(input) : input;
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return "منذ لحظات";
  if (diffSec < 60) return `منذ ${diffSec} ثانية`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `منذ ${diffDays} يوم`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `منذ ${diffMonths} شهر`;

  const diffYears = Math.floor(diffMonths / 12);
  return `منذ ${diffYears} سنة`;
}

function ageFromUser(user: { age?: number | null; dateOfBirth?: string }): number | null {
  if (typeof user.age === "number") return user.age;
  if (!user.dateOfBirth) return null;
  const y = parseInt(user.dateOfBirth.slice(0, 4), 10);
  const m = parseInt(user.dateOfBirth.slice(5, 7), 10);
  if (isNaN(y) || isNaN(m)) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m) age -= 1;
  return age >= 0 ? age : null;
}

type User = {
  id?: string;
  name?: string;
  email: string;
  profileImage?: string;
  age?: number | null;
  dateOfBirth?: string;
  country?: string;
  gender?: string;
};

type Props = { user: User };

export default function MomentScreen({ user }: Props) {
  const { show } = useAppAlert();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [videoModal, setVideoModal] = useState<Moment | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<Video>(null);
  const [filter, setFilter] = useState<"all" | "following">("all");
  const [likersVisible, setLikersVisible] = useState(false);
  const [likers, setLikers] = useState<MomentLiker[]>([]);
  const [likersLoading, setLikersLoading] = useState(false);
  const [likersError, setLikersError] = useState<string | null>(null);
  const [lastSeenLikesTotal, setLastSeenLikesTotal] = useState(0);
  const [countryFilter, setCountryFilter] = useState<string | "all">("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [countryModalVisible, setCountryModalVisible] = useState(false);

  const loadMoments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await fetchMoments();
      setMoments(list);
    } catch {
      setMoments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMoments();
  }, [loadMoments]);

  const currentUserId = user.id || user.email?.split("@")[0] || "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!currentUserId) return;
        const stored = await AsyncStorage.getItem(`moments_lastSeenLikesTotal_${currentUserId}`);
        if (!cancelled && stored != null) {
          const num = parseInt(stored, 10);
          if (!Number.isNaN(num)) {
            setLastSeenLikesTotal(num);
          }
        }
      } catch {
        // تجاهل أي خطأ في القراءة
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const handleAddMoment = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      show({ title: "تنبيه", message: "يجب السماح بالوصول للصور والفيديو", type: "warning" });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    const durationMillis = asset.duration ?? 0;
    const durationSec = Math.ceil(durationMillis / 1000);

    if (isVideo && durationSec > MAX_VIDEO_SEC) {
      show({
        title: "فيديو طويل",
        message: `الحد الأقصى للفيديو ${MAX_VIDEO_SEC} ثوانٍ. المدة المختارة: ${durationSec} ثانية.`,
        type: "warning",
      });
      return;
    }

    setPosting(true);
    try {
      const userId = user.id || user.email?.split("@")[0] || "";
      
      let thumbnailUri: string | undefined;
      if (isVideo) {
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 500 });
          thumbnailUri = thumb.uri;
        } catch (thumbErr) {
          console.log("Thumbnail generation failed:", thumbErr);
        }
      }

      const moment = await createMoment({
        uri: asset.uri,
        mediaType: isVideo ? "video" : "image",
        durationSeconds: isVideo ? durationSec : undefined,
        thumbnailUri,
        userId,
        userName: user.name || "مستخدم",
        userAge: ageFromUser(user),
        userGender: user.gender || null,
        userCountry: user.country || null,
        userProfileImage: user.profileImage || null,
      });
      if (moment) {
        setMoments((prev) => [moment, ...prev]);
      } else {
        show({
          title: "تنبيه",
          message: "تعذر النشر. تأكد من الاتصال أو أن الخادم يدعم اللحظات.",
          type: "warning",
        });
      }
    } catch (e) {
      show({ title: "خطأ", message: (e as Error)?.message || "تعذر رفع اللحظة", type: "error" });
    } finally {
      setPosting(false);
    }
  }, [user, show]);

  const handleLike = useCallback(async (moment: Moment, e?: any) => {
    e?.stopPropagation?.();
    const res = await toggleMomentLike(moment.id);
    if (res)
      setMoments((prev) =>
        prev.map((m) =>
          m.id === moment.id ? { ...m, likeCount: res.likeCount, likedByMe: res.likedByMe } : m
        )
      );
  }, []);

  const openVideo = useCallback((moment: Moment) => {
    if (moment.mediaType !== "video") return;
    console.log("Opening video URL:", moment.mediaUrl);
    setVideoError(null);
    setVideoLoading(true);
    setVideoModal(moment);
  }, []);

  const closeVideo = useCallback(() => {
    setVideoModal(null);
    setVideoLoading(false);
    setVideoError(null);
  }, []);

  const handleDelete = useCallback(
    async (moment: Moment, e?: any) => {
      e?.stopPropagation?.();
      if (moment.userId !== currentUserId) return;
      show({
        title: "حذف اللحظة",
        message: "هل تريد حذف هذه اللحظة؟",
        type: "warning",
        buttons: [
          { text: "إلغاء", style: "cancel" },
          {
            text: "حذف",
            style: "destructive",
            onPress: async () => {
              const ok = await deleteMoment(moment.id);
              if (ok) {
                setMoments((prev) => prev.filter((m) => m.id !== moment.id));
                if (videoModal?.id === moment.id) closeVideo();
              } else {
                show({ title: "خطأ", message: "تعذر الحذف", type: "error" });
              }
            },
          },
        ],
      });
    },
    [currentUserId, videoModal, closeVideo, show]
  );

  const totalMyLikes = moments
    .filter((m) => m.userId === currentUserId)
    .reduce((sum, m) => sum + (m.likeCount || 0), 0);

  const unreadLikes = Math.max(totalMyLikes - lastSeenLikesTotal, 0);

  const visibleMoments = (() => {
    let list = filter === "all" ? moments : moments.filter((m) => m.userId === currentUserId);

    if (countryFilter !== "all") {
      list = list.filter((m) => {
        const baseCountry = m.userCountry ?? null;
        const fallbackCountry = m.userId === currentUserId ? user.country ?? null : null;
        const country = baseCountry || fallbackCountry;
        return country === countryFilter;
      });
    }

    if (genderFilter !== "all") {
      list = list.filter((m) => {
        const baseGender = m.userGender ?? null;
        const fallbackGender = m.userId === currentUserId ? user.gender ?? null : null;
        const gender = baseGender || fallbackGender;
        return gender === genderFilter;
      });
    }

    return list;
  })();

  const openLikers = useCallback(async () => {
    setLikersVisible(true);
    setLikersLoading(true);
    setLikersError(null);
    try {
      const list = await fetchMyMomentLikers();
      setLikers(list);
    } catch (e) {
      setLikersError((e as Error)?.message || "تعذر جلب قائمة المعجبين");
    } finally {
      setLikersLoading(false);
      // اعتبار كل الإعجابات الحالية "مقروءة" بعد فتح القائمة
      setLastSeenLikesTotal(totalMyLikes);
      if (currentUserId) {
        AsyncStorage.setItem(
          `moments_lastSeenLikesTotal_${currentUserId}`,
          String(totalMyLikes)
        ).catch(() => {});
      }
    }
  }, [totalMyLikes, currentUserId]);

  const closeLikers = useCallback(() => {
    setLikersVisible(false);
  }, []);

  const handleGenderPress = useCallback(
    (target: "male" | "female") => {
      setGenderFilter((prev) => (prev === target ? "all" : target));
    },
    []
  );

  const renderMoment = useCallback(
    ({ item }: { item: Moment }) => {
      const isMyMoment = item.userId === currentUserId;
      const gender = (isMyMoment ? user.gender : item.userGender) || undefined;
      const age = item.userAge;
      const countryCode = (isMyMoment ? user.country : item.userCountry) || "";
      const flag = countryCode ? getFlagEmoji(countryCode) : "";
      const countryName = countryCode ? getCountryName(countryCode) : "";
      const profileImage = isMyMoment ? user.profileImage : item.userProfileImage;

      const createdLabel = formatRelativeTime(item.createdAt);

      return (
        <View style={styles.gridItem}>
          <TouchableOpacity
            style={[styles.gridCard, CARD_SHADOW]}
            onPress={() => (item.mediaType === "video" ? openVideo(item) : null)}
            activeOpacity={item.mediaType === "video" ? 0.9 : 1}
          >
            {item.mediaType === "image" ? (
              <View style={styles.mediaWrapper}>
                <Image source={{ uri: item.mediaUrl }} style={styles.gridMedia} resizeMode="cover" />
                <View style={styles.likeOverlay}>
                  <TouchableOpacity
                    style={styles.gridLike}
                    onPress={(e) => handleLike(item, e)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.likedByMe ? "thumbs-up" : "thumbs-up-outline"}
                      size={18}
                      color={item.likedByMe ? "#22c55e" : TEXT_LIGHT}
                    />
                    <Text style={styles.gridLikeCount}>{item.likeCount}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.mediaWrapper}>
                <View style={styles.videoThumb}>
                  {item.thumbnailUrl ? (
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.gridMedia} resizeMode="cover" />
                  ) : (
                    <View style={[styles.gridMedia, styles.videoPlaceholder]}>
                      <Ionicons name="videocam" size={32} color="rgba(196,181,253,0.5)" />
                    </View>
                  )}
                  <View style={styles.playOverlay}>
                    <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.95)" />
                  </View>
                  {item.durationSeconds != null ? (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>{`${item.durationSeconds} ث`}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.likeOverlay}>
                  <TouchableOpacity
                    style={styles.gridLike}
                    onPress={(e) => handleLike(item, e)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.likedByMe ? "thumbs-up" : "thumbs-up-outline"}
                      size={18}
                      color={item.likedByMe ? "#22c55e" : TEXT_LIGHT}
                    />
                    <Text style={styles.gridLikeCount}>{item.likeCount}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={styles.gridFooter}>
              <View style={styles.userInfoRow}>
                <View style={styles.avatarSmallWrap}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.avatarSmall} />
                  ) : (
                    <View style={[styles.avatarSmall, styles.avatarSmallPlaceholder]}>
                      <Ionicons name="person" size={16} color={TEXT_MUTED} />
                    </View>
                  )}
                </View>
                <View style={styles.userTextCol}>
                  <Text style={styles.gridName} numberOfLines={1}>
                    {item.userName}
                  </Text>
                  {countryCode ? (
                    <View style={styles.locationRow}>
                      {!!flag && <Text style={styles.locationFlag}>{flag}</Text>}
                      <Text style={styles.locationText} numberOfLines={1}>
                        {countryName || countryCode}
                      </Text>
                    </View>
                  ) : null}
                  {gender && age != null && (
                    <View
                      style={[
                        styles.genderBadge,
                        gender === "male" ? styles.genderBadgeMale : styles.genderBadgeFemale,
                      ]}
                    >
                      <Ionicons
                        name={gender === "male" ? "male" : "female"}
                        size={14}
                        color="#ffffff"
                      />
                      <Text style={styles.genderBadgeText}>{age}</Text>
                    </View>
                  )}
                  {!!createdLabel && (
                    <Text style={styles.momentTimeText}>{createdLabel}</Text>
                  )}
                </View>
              </View>
              <View style={styles.gridActions}>
                {item.userId === currentUserId && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={(e) => handleDelete(item, e)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color="#f87171" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [handleLike, openVideo, handleDelete, currentUserId, user]
  );

  if (loading && moments.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT_SOFT} />
        <Text style={styles.loadingText}>جاري تحميل اللحظات...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTabs}>
          <TouchableOpacity
            style={[styles.headerTab, filter === "following" && styles.headerTabActive]}
            onPress={() => setFilter("following")}
            activeOpacity={0.8}
          >
            <Text style={[styles.headerTabText, filter === "following" && styles.headerTabTextActive]}>
              اتبع
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerTab, filter === "all" && styles.headerTabActive]}
            onPress={() => setFilter("all")}
            activeOpacity={0.8}
          >
            <Text style={[styles.headerTabText, filter === "all" && styles.headerTabTextActive]}>
              جميع اللحظات
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.bellWrap} onPress={openLikers} activeOpacity={0.8}>
            <Ionicons name="notifications-outline" size={22} color={ACCENT_SOFT} />
            {unreadLikes > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadLikes > 99 ? "99+" : unreadLikes}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconCircle}
            onPress={() => setCountryModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="globe-outline" size={20} color={ACCENT_SOFT} />
          </TouchableOpacity>
          <View style={styles.genderToggle}>
            <TouchableOpacity
              style={styles.genderToggleBtn}
              activeOpacity={0.8}
              onPress={() => handleGenderPress("male")}
            >
              <Ionicons
                name="male"
                size={16}
                color={genderFilter === "male" ? "#38bdf8" : TEXT_MUTED}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.genderToggleBtn}
              activeOpacity={0.8}
              onPress={() => handleGenderPress("female")}
            >
              <Ionicons
                name="female"
                size={16}
                color={genderFilter === "female" ? "#fb7185" : TEXT_MUTED}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    

      <FlatList
        data={visibleMoments}
        renderItem={renderMoment}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadMoments(true)} tintColor={ACCENT_SOFT} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="images-outline" size={56} color={TEXT_MUTED} />
            <Text style={styles.emptyTitle}>لا توجد لحظات بعد</Text>
            <Text style={styles.emptySub}>انشر أول لحظة بالضغط على الزر أدناه</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, posting && styles.fabDisabled]}
        onPress={handleAddMoment}
        disabled={posting}
        activeOpacity={0.85}
      >
        {posting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="add" size={28} color="#fff" />
        )}
      </TouchableOpacity>

      {/* مشغل الفيديو — يظهر عند الضغط على فيديو */}
      <Modal
        visible={!!videoModal}
        animationType="fade"
        transparent
        onRequestClose={closeVideo}
      >
        <Pressable style={styles.videoModalOverlay} onPress={closeVideo}>
          <View style={styles.videoModalContent}>
            {videoModal && (
              <Pressable onPress={(e) => e.stopPropagation()} style={styles.videoContainer}>
                {videoLoading && (
                  <View style={styles.videoLoadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.videoLoadingText}>جاري تحميل الفيديو...</Text>
                  </View>
                )}
                {videoError ? (
                  <View style={styles.videoErrorWrap}>
                    <Ionicons name="alert-circle-outline" size={48} color="#f87171" />
                    <Text style={styles.videoErrorText}>{videoError}</Text>
                    <Text style={styles.videoHintText}>افتح الرابط في المتصفح أولاً:</Text>
                    <Text style={styles.videoUrlText} selectable>https://myapi123.loca.lt</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => videoModal && openVideo(videoModal)}>
                      <Text style={styles.retryText}>إعادة المحاولة</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Video
                    ref={videoRef}
                    source={{ 
                      uri: videoModal.mediaUrl,
                      headers: { "bypass-tunnel-reminder": "true" }
                    }}
                    style={styles.videoPlayer}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                    isLooping={false}
                    volume={1}
                    onLoad={() => setVideoLoading(false)}
                    onError={(e) => {
                      setVideoLoading(false);
                      setVideoError("تعذر تشغيل الفيديو (511)");
                      console.log("Video error:", e);
                    }}
                  />
                )}
              </Pressable>
            )}
            <TouchableOpacity style={styles.closeVideoBtn} onPress={closeVideo}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {videoModal && videoModal.userId === currentUserId && (
              <TouchableOpacity
                style={styles.deleteVideoBtn}
                onPress={() => handleDelete(videoModal)}
              >
                <Ionicons name="trash-outline" size={24} color="#f87171" />
                <Text style={styles.deleteVideoText}>حذف</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* قائمة المعجبين بلحظات المستخدم */}
      <Modal
        visible={likersVisible}
        transparent
        animationType="slide"
        onRequestClose={closeLikers}
      >
        <Pressable style={styles.likersOverlay} onPress={closeLikers}>
          <Pressable style={styles.likersSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.likersHeader}>
              <Text style={styles.likersTitle}>المستخدمون الذين أعجبوا بلحظاتك</Text>
              <TouchableOpacity onPress={closeLikers} style={styles.likersCloseBtn}>
                <Ionicons name="close" size={20} color={TEXT_MUTED} />
              </TouchableOpacity>
            </View>
            {likersLoading ? (
              <View style={styles.likersLoading}>
                <ActivityIndicator size="small" color={ACCENT_SOFT} />
                <Text style={styles.likersLoadingText}>جاري التحميل...</Text>
              </View>
            ) : likersError ? (
              <Text style={styles.likersErrorText}>{likersError}</Text>
            ) : likers.length === 0 ? (
              <Text style={styles.likersEmptyText}>لا يوجد معجبون بلحظاتك حتى الآن</Text>
            ) : (
              <FlatList
                data={likers}
                keyExtractor={(u) => u.userId}
                renderItem={({ item }) => {
                  const flag = item.country ? getFlagEmoji(item.country) : "";
                  const countryName = item.country ? getCountryName(item.country) : "";
                  const genderBadgeStyle =
                    item.gender === "male"
                      ? styles.genderBadgeMale
                      : item.gender === "female"
                      ? styles.genderBadgeFemale
                      : null;
                  const likedAtLabel = formatRelativeTime(item.lastLikedAt || null);
                  return (
                    <View style={styles.likerRow}>
                      <View style={styles.likerAvatarWrap}>
                        {item.profileImage ? (
                          <Image source={{ uri: item.profileImage }} style={styles.likerAvatar} />
                        ) : (
                          <View style={[styles.likerAvatar, styles.avatarSmallPlaceholder]}>
                            <Ionicons name="person" size={20} color={TEXT_MUTED} />
                          </View>
                        )}
                      </View>
                      <View style={styles.likerInfo}>
                        <Text style={styles.likerName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View style={styles.likerMetaRow}>
                          {item.age != null && genderBadgeStyle && (
                            <View style={[styles.genderBadge, genderBadgeStyle]}>
                              <Ionicons
                                name={item.gender === "male" ? "male" : "female"}
                                size={12}
                                color="#ffffff"
                              />
                              <Text style={styles.genderBadgeText}>{item.age}</Text>
                            </View>
                          )}
                          {item.country ? (
                            <View style={styles.likerLocationRow}>
                              {!!flag && <Text style={styles.locationFlag}>{flag}</Text>}
                              <Text style={styles.locationText} numberOfLines={1}>
                                {countryName || item.country}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {!!likedAtLabel && (
                          <Text style={styles.likerTimeText}>{likedAtLabel}</Text>
                        )}
                      </View>
                      {item.lastMediaUrl && (
                        <View style={styles.likerMomentThumbWrap}>
                          <Image
                            source={{ uri: item.lastThumbnailUrl || item.lastMediaUrl }}
                            style={styles.likerMomentThumb}
                          />
                          {item.lastMediaType === "video" && (
                            <View style={styles.likerMomentPlayOverlay}>
                              <Ionicons name="play" size={12} color="#ffffff" />
                            </View>
                          )}
                        </View>
                      )}
                      <View style={styles.likerLikeCountWrap}>
                        <Ionicons name="thumbs-up" size={16} color={ACCENT_SOFT} />
                        <Text style={styles.likerLikeCountText}>{item.likeCount}</Text>
                      </View>
                    </View>
                  );
                }}
                contentContainerStyle={styles.likersListContent}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* فلتر الدول */}
      <Modal
        visible={countryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <Pressable style={styles.likersOverlay} onPress={() => setCountryModalVisible(false)}>
          <Pressable style={styles.likersSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.likersHeader}>
              <Text style={styles.likersTitle}>تصفية حسب الدولة</Text>
              <TouchableOpacity
                onPress={() => setCountryModalVisible(false)}
                style={styles.likersCloseBtn}
              >
                <Ionicons name="close" size={20} color={TEXT_MUTED} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[
                { code: "all", name: "جميع الدول", flag: "" },
                ...Array.from(
                  new Set(
                    moments
                      .map((m) => m.userCountry || (m.userId === currentUserId ? user.country || null : null))
                      .filter((c): c is string => !!c)
                  )
                ).map((code) => ({
                  code,
                  name: getCountryName(code) || code,
                  flag: getFlagEmoji(code),
                })),
              ]}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryRow}
                  activeOpacity={0.8}
                  onPress={() => {
                    setCountryFilter(item.code === "all" ? "all" : item.code);
                    setCountryModalVisible(false);
                  }}
                >
                  <View style={styles.countryLeft}>
                    {!!item.flag && <Text style={styles.locationFlag}>{item.flag}</Text>}
                    <Text style={styles.countryNameText}>{item.name}</Text>
                  </View>
                  {countryFilter === item.code && (
                    <Ionicons name="checkmark-circle" size={18} color={ACCENT_SOFT} />
                  )}
                  {countryFilter !== "all" && item.code === "all" && (
                    <Ionicons name="checkmark-circle-outline" size={18} color={TEXT_MUTED} />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.likersListContent}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PURPLE_DARK, paddingTop: 49 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: PURPLE_DARK, gap: 12 },
  loadingText: { fontSize: 14, color: TEXT_MUTED },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTabs: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
  },
  headerTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(24, 20, 37, 0.9)",
  },
  headerTabActive: {
    backgroundColor: "rgba(167, 139, 250, 0.35)",
    borderColor: "rgba(196, 181, 253, 0.9)",
  },
  headerTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_MUTED,
  },
  headerTabTextActive: {
    color: TEXT_LIGHT,
  },
  bellWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(24, 20, 37, 0.9)",
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    paddingHorizontal: 4,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(24, 20, 37, 0.9)",
  },
  genderToggle: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "rgba(24, 20, 37, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
  },
  genderToggleBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: { fontSize: 13, color: TEXT_MUTED, paddingHorizontal: 20, marginBottom: 8 },
  gridContent: { paddingHorizontal: 20, paddingBottom: 100 },
  gridRow: { gap: GAP, marginBottom: GAP },
  gridItem: { flex: 1, maxWidth: (SCREEN_WIDTH - 40 - GAP) / 2 },
  gridCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.12)",
    ...CARD_SHADOW,
  },
  gridMedia: { width: "100%", aspectRatio: 1 },
  mediaWrapper: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
  },
  videoThumb: { width: "100%", aspectRatio: 1, position: "relative" },
  videoPlaceholder: {
    backgroundColor: "rgba(45, 38, 64, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  durationText: { fontSize: 10, color: "#fff", fontWeight: "700" },
  gridFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
  },
  userInfoRow: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  avatarSmallWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.4)",
  },
  avatarSmall: { width: "100%", height: "100%" },
  avatarSmallPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  userTextCol: { flex: 1 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  locationFlag: { fontSize: 12 },
  locationText: { fontSize: 11, color: TEXT_MUTED },
  gridActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  deleteBtn: { padding: 4 },
  likeOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  gridName: { fontSize: 13, fontWeight: "700", color: TEXT_LIGHT },
  gridAge: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  momentTimeText: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  genderBadge: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  genderBadgeMale: {
    backgroundColor: "#38bdf8",
  },
  genderBadgeFemale: {
    backgroundColor: "#fb7185",
  },
  genderBadgeText: { fontSize: 12, fontWeight: "700", color: "#ffffff" },
  gridLike: { flexDirection: "row", alignItems: "center", gap: 4 },
  gridLikeCount: { fontSize: 12, fontWeight: "600", color: TEXT_LIGHT },
  emptyWrap: { alignItems: "center", paddingVertical: 48, gap: 12, flex: 1 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: TEXT_LIGHT },
  emptySub: { fontSize: 14, color: TEXT_MUTED },
  fab: {
    position: "absolute",
    bottom: 24,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#A855F7",
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  fabDisabled: { opacity: 0.7 },
  videoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoModalContent: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
    justifyContent: "center",
    alignItems: "center",
  },
  videoPlayer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  videoLoadingText: { color: "#fff", fontSize: 14 },
  videoErrorWrap: {
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  videoErrorText: { color: "#f87171", fontSize: 14, textAlign: "center" },
  videoHintText: { color: TEXT_MUTED, fontSize: 12, marginTop: 12 },
  videoUrlText: { color: ACCENT_SOFT, fontSize: 12, marginTop: 4 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  closeVideoBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteVideoBtn: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(248, 113, 113, 0.25)",
    borderRadius: 12,
  },
  deleteVideoText: { fontSize: 16, fontWeight: "600", color: "#f87171" },
  likersOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  likersSheet: {
    backgroundColor: PURPLE_DARK,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  likersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  likersTitle: { fontSize: 15, fontWeight: "700", color: TEXT_LIGHT },
  likersCloseBtn: { padding: 6 },
  likersLoading: {
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
  },
  likersLoadingText: { fontSize: 13, color: TEXT_MUTED },
  likersErrorText: { fontSize: 13, color: "#f87171", textAlign: "center", paddingVertical: 16 },
  likersEmptyText: { fontSize: 13, color: TEXT_MUTED, textAlign: "center", paddingVertical: 16 },
  likersListContent: {
    paddingBottom: 8,
  },
  likerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167, 139, 250, 0.16)",
  },
  likerAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.4)",
    marginRight: 10,
  },
  likerAvatar: { width: "100%", height: "100%" },
  likerInfo: { flex: 1 },
  likerName: { fontSize: 14, fontWeight: "700", color: TEXT_LIGHT, marginBottom: 4 },
  likerMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  likerLocationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  likerMomentThumbWrap: {
    width: 50,
    height: 50,
    borderRadius: 12,
    overflow: "hidden",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.5)",
    position: "relative",
  },
  likerMomentThumb: { width: "100%", height: "100%" },
  likerMomentPlayOverlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  likerLikeCountWrap: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 },
  likerLikeCountText: { fontSize: 12, color: TEXT_LIGHT, fontWeight: "600" },
  likerTimeText: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167, 139, 250, 0.16)",
  },
  countryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countryNameText: {
    fontSize: 14,
    color: TEXT_LIGHT,
  },
});
