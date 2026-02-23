import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getFlagEmoji, getCountryName } from "../../utils/countries";
import { API_BASE_URL } from "../../utils/authHelper";
import { fetchMoments, deleteMoment, fetchMomentLikers, type Moment, type MomentLiker } from "../../utils/momentsApi";
import { Video, ResizeMode } from "expo-av";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDER_HEIGHT = 320;
const CARD_MARGIN = 16;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;

const PURPLE_DARK = "#050816";
const ACCENT_SOFT = "#c4b5fd";
const ACCENT_MUTED = "rgba(88, 28, 135, 0.35)";
const ACCENT_MUTED_DARK = "rgba(15, 23, 42, 0.95)";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const BORDER_ACCENT = "rgba(167, 139, 250, 0.4)";
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  android: { elevation: 6 },
});

function getDeviceCountryCode(): string {
  try {
    const locale = Localization.getLocales?.()?.[0] as {
      regionCode?: string;
      countryCode?: string;
    } | undefined;
    const region = locale?.regionCode || locale?.countryCode || "";
    return region ? String(region).toUpperCase().slice(0, 2) : "";
  } catch {
    return "";
  }
}

function ageFromDateOfBirth(dateStr?: string): number | null {
  if (!dateStr) return null;
  const y = parseInt(dateStr.slice(0, 4), 10);
  const m = parseInt(dateStr.slice(5, 7), 10);
  if (isNaN(y) || isNaN(m)) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m) age -= 1;
  return age >= 0 ? age : null;
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
function formatDateOfBirth(dateStr: string): string {
  const y = dateStr.slice(0, 4);
  const m = parseInt(dateStr.slice(5, 7), 10);
  const monthName = m >= 1 && m <= 12 ? MONTHS_AR[m - 1] : "";
  return monthName ? `${monthName} ${y}` : dateStr;
}

function InfoRow({
  icon,
  label,
  value,
  trailing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  trailing?: "copy";
}) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.iconWrap}>
        <Ionicons name={icon} size={20} color={ACCENT_SOFT} />
      </View>
      <View style={rowStyles.textWrap}>
        <Text style={rowStyles.label}>{label}</Text>
        <Text style={rowStyles.value} numberOfLines={2}>{value}</Text>
      </View>
      {trailing === "copy" && (
        <Ionicons name="copy-outline" size={18} color={ACCENT_SOFT} style={rowStyles.trailing} />
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: ACCENT_MUTED, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  textWrap: { flex: 1 },
  label: { fontSize: 12, color: TEXT_MUTED, marginBottom: 2 },
  value: { fontSize: 15, fontWeight: "600", color: TEXT_LIGHT },
  trailing: { marginRight: 4 },
});

function InfoRowSeparator() {
  return <View style={{ height: 1, backgroundColor: "rgba(167, 139, 250, 0.12)", marginLeft: 64 }} />;
}

type UserProfile = {
  id?: string;
  name?: string;
  email: string;
  profileImage?: string;
  age?: number | null;
  dateOfBirth?: string;
  country?: string;
  gender?: string;
  height?: number | null;
  weight?: number | null;
  hobby?: string;
  month?: string;
};

type Props = {
  user: UserProfile;
  onBack: () => void;
};

export default function InfoScreen({ user: userProp, onBack }: Props) {
  const deviceCountry = getDeviceCountryCode();
  const [profile, setProfile] = useState<UserProfile | null>(userProp);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [momentsError, setMomentsError] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState<Moment | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [momentLikers, setMomentLikers] = useState<MomentLiker[]>([]);
  const [momentLikersLoading, setMomentLikersLoading] = useState(false);
  const [momentLikersError, setMomentLikersError] = useState<string | null>(null);

  const user = profile || userProp;
  const countryCode = user.country || deviceCountry || "";
  const flag = getFlagEmoji(countryCode);
  const countryName = getCountryName(countryCode);
  const age = user.age ?? ageFromDateOfBirth(user.dateOfBirth);
  const userId = user.id || user.email?.split("@")[0] || "—";

  const scrollRef = useRef<ScrollView>(null);
  const videoRef = useRef<Video>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"info" | "moment">("info");
  const photos = user.profileImage ? [user.profileImage] : [];

  const profileId = user.id || user.email || "";
  const [likeCount, setLikeCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    const keyLiked = `profile_liked_${profileId}`;
    const keyCount = `profile_likes_count_${profileId}`;
    AsyncStorage.multiGet([keyLiked, keyCount]).then(([[, vLiked], [, vCount]]) => {
      if (vLiked === "1") setHasLiked(true);
      if (vCount != null) setLikeCount(parseInt(vCount, 10) || 0);
    });
  }, [profileId]);

  const onLikePress = useCallback(async () => {
    if (hasLiked) {
      Alert.alert("تم بالفعل", "لا يمكن الإعجاب أكثر من مرة واحدة.");
      return;
    }
    const newCount = likeCount + 1;
    setLikeCount(newCount);
    setHasLiked(true);
    const keyLiked = `profile_liked_${profileId}`;
    const keyCount = `profile_likes_count_${profileId}`;
    await AsyncStorage.multiSet([[keyLiked, "1"], [keyCount, String(newCount)]]);
  }, [hasLiked, likeCount, profileId]);

  const fetchProfile = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setProfile(userProp);
        return;
      }
      const res = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      if (res.data?.success && res.data?.user) {
        setProfile(res.data.user as UserProfile);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setProfile(userProp);
      } else {
        setError(e?.message || "تعذر جلب البيانات");
        setProfile(userProp);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProp]);

  const loadMyMoments = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setMomentsLoading(true);
      setMomentsError(null);
      try {
        const list = await fetchMoments();
        const baseId = user.id || user.email?.split("@")[0] || "";
        const mine = list.filter((m) => m.userId === baseId);
        setMoments(mine);
      } catch (e: any) {
        setMomentsError(e?.message || "تعذر جلب لحظاتك");
        setMoments([]);
      } finally {
        setMomentsLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  const openVideo = useCallback((moment: Moment) => {
    setVideoModal(moment);
    setVideoError(null);
    setVideoLoading(moment.mediaType === "video");
    setMomentLikers([]);
    setMomentLikersError(null);
    setMomentLikersLoading(true);

    // جلب المعجبين الخاصين بهذه اللحظة فقط
    fetchMomentLikers(moment.id)
      .then((list) => {
        setMomentLikers(list);
      })
      .catch((e: any) => {
        setMomentLikersError(e?.message || "تعذر جلب قائمة المعجبين");
      })
      .finally(() => {
        setMomentLikersLoading(false);
      });
  }, []);

  const closeVideo = useCallback(() => {
    setVideoModal(null);
    setVideoLoading(false);
    setVideoError(null);
  }, []);

  const handleDeleteMoment = useCallback(
    async (moment: Moment) => {
      Alert.alert(
        "حذف اللحظة",
        "هل تريد حذف هذه اللحظة؟",
        [
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
                Alert.alert("خطأ", "تعذر الحذف");
              }
            },
          },
        ]
      );
    },
    [closeVideo, videoModal]
  );

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (activeTab === "moment") {
      loadMyMoments();
    }
  }, [activeTab, loadMyMoments]);

  const onScrollSlider = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / (CARD_WIDTH + CARD_MARGIN));
    setSlideIndex(Math.min(index, photos.length));
  }, [photos.length]);

  const copyUserId = useCallback(async () => {
    await Clipboard.setStringAsync(String(userId));
    Alert.alert("تم النسخ", "تم نسخ المعرف بنجاح");
  }, [userId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-forward" size={22} color={ACCENT_SOFT} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
      </View>

      {/* سلايدر الصورة الشخصية — يبقى فوق دائماً */}
      <View style={styles.sliderWrap}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          onMomentumScrollEnd={onScrollSlider}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sliderContent}
          snapToInterval={CARD_WIDTH + CARD_MARGIN}
          snapToAlignment="center"
          decelerationRate="fast"
        >
          {photos.length > 0 ? (
              photos.map((uri, i) => (
                  <View key={i} style={styles.slideCard}>
                    <Image source={{ uri }} style={styles.slideImage} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.likeIconWrap}
                      onPress={onLikePress}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={hasLiked ? "heart" : "heart-outline"}
                        size={22}
                        color={hasLiked ? "#f43f5e" : "#f5f3ff"}
                      />
                      <Text style={styles.likeCountText}>{likeCount}</Text>
                    </TouchableOpacity>
                  </View>
                ))
          ) : (
              <View style={[styles.slideCard, styles.slidePlaceholder]}>
                  <Ionicons name="person" size={64} color={TEXT_MUTED} />
                  <Text style={styles.slidePlaceholderText}>لا توجد صورة شخصية</Text>
                </View>
          )}
        </ScrollView>
        {photos.length > 1 ? (
          <View style={styles.pagination}>
            {photos.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, slideIndex === i && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* تبويبان: لحظة | معلومات — جنب بعض مع مسافة بينهم */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "moment" && styles.tabActive]}
          onPress={() => setActiveTab("moment")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === "moment" && styles.tabTextActive]}>
            لحظة
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "info" && styles.tabActive]}
          onPress={() => setActiveTab("info")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === "info" && styles.tabTextActive]}>
            معلومات
          </Text>
        </TouchableOpacity>
      </View>

      {/* المحتوى يتغير حسب التبويب — الصورة والتبويبان يبقون */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (activeTab === "info") fetchProfile(true);
              else loadMyMoments(true);
            }}
            tintColor={ACCENT_SOFT}
          />
        }
      >
        {activeTab === "moment" ? (
          <View style={styles.momentContent}>
          

            {momentsLoading ? (
              <View style={styles.momentLoadingWrap}>
                <ActivityIndicator size="large" color={ACCENT_SOFT} />
                <Text style={styles.loadingText}>جاري جلب لحظاتك...</Text>
              </View>
            ) : momentsError ? (
              <View style={styles.momentErrorWrap}>
                <Ionicons name="alert-circle-outline" size={20} color={TEXT_MUTED} />
                <Text style={styles.errorText}>{momentsError}</Text>
              </View>
            ) : moments.length === 0 ? (
              <View style={styles.momentEmptyWrap}>
                <Ionicons name="images-outline" size={42} color={TEXT_MUTED} />
                <Text style={styles.momentEmptyTitle}>لا توجد لحظات بعد</Text>
                <Text style={styles.momentEmptySub}>
                  قم بنشر أول لحظة من صفحة اللحظات، وستظهر هنا تلقائيًا.
                </Text>
              </View>
            ) : (
              <View style={styles.momentList}>
                {moments.map((m) => (
                  <View key={m.id} style={[styles.momentCard, CARD_SHADOW]}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => openVideo(m)}
                    >
                      <View style={styles.momentMediaWrap}>
                        <Image
                          source={{ uri: m.thumbnailUrl || m.mediaUrl }}
                          style={styles.momentImage}
                          resizeMode="cover"
                        />
                        {m.mediaType === "video" && (
                          <View style={styles.momentPlayOverlay}>
                            <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.95)" />
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.momentDeleteBtn}
                          activeOpacity={0.7}
                          onPress={() => handleDeleteMoment(m)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#f87171" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.momentInfoRow}>
                      <View>
                        <Text style={styles.momentInfoTitle} numberOfLines={1}>
                          {user.name || "أنا"}
                        </Text>
                        {!!m.createdAt && (
                          <Text style={styles.momentInfoMeta}>
                            {new Date(m.createdAt).toLocaleString()}
                          </Text>
                        )}
                      </View>
                      <View style={styles.momentLikesRow}>
                        <Ionicons name="thumbs-up" size={18} color={ACCENT_SOFT} />
                        <Text style={styles.momentLikesText}>{m.likeCount}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : loading && !profile ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={ACCENT_SOFT} />
            <Text style={styles.loadingText}>جاري جلب معلوماتك...</Text>
          </View>
        ) : (
          <View style={styles.infoSections}>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="cloud-offline-outline" size={20} color={TEXT_MUTED} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* قسم معلومات الحساب */}
            <Text style={styles.sectionTitle}>معلومات الحساب</Text>
            <View style={[styles.sectionCard, CARD_SHADOW]}>
              <InfoRow icon="person-outline" label="الاسم" value={user.name || "—"} />
              <InfoRowSeparator />
              <TouchableOpacity style={styles.infoRowTouch} onPress={copyUserId} activeOpacity={0.7}>
                <InfoRow icon="finger-print-outline" label="المعرف" value={userId} trailing="copy" />
              </TouchableOpacity>
              <InfoRowSeparator />
              <InfoRow icon="mail-outline" label="البريد الإلكتروني" value={user.email || "—"} />
            </View>

            {/* قسم التفاصيل الشخصية */}
            <Text style={styles.sectionTitle}>التفاصيل الشخصية</Text>
            <View style={[styles.sectionCard, CARD_SHADOW]}>
              <InfoRow icon="globe-outline" label="الدولة" value={countryName ? `${flag} ${countryName}` : "—"} />
              {(user.gender || age != null) && (
                <>
                  <InfoRowSeparator />
                  <InfoRow
                    icon="people-outline"
                    label="الجنس والعمر"
                    value={[user.gender === "male" ? "ذكر" : user.gender === "female" ? "أنثى" : "", age != null ? `${age} سنة` : ""].filter(Boolean).join(" · ") || "—"}
                  />
                </>
              )}
              {(user.height != null && user.height > 0) && (
                <>
                  <InfoRowSeparator />
                  <InfoRow icon="resize-outline" label="الطول" value={`${user.height} سم`} />
                </>
              )}
              {(user.weight != null && user.weight > 0) && (
                <>
                  <InfoRowSeparator />
                  <InfoRow icon="barbell-outline" label="الوزن" value={`${user.weight} كغ`} />
                </>
              )}
              {(user.hobby && user.hobby.trim()) && (
                <>
                  <InfoRowSeparator />
                  <InfoRow icon="heart-outline" label="الهوايات" value={user.hobby.trim()} />
                </>
              )}
              {(user.dateOfBirth || user.month) && (
                <>
                  <InfoRowSeparator />
                  <InfoRow icon="calendar-outline" label="تاريخ الميلاد" value={user.dateOfBirth ? formatDateOfBirth(user.dateOfBirth) : user.month || "—"} />
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* تفاصيل اللحظة داخل صفحة المعلومات: صورة/فيديو + المعجبين */}
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
                <View style={styles.detailsMediaWrap}>
                  {videoModal.mediaType === "video" ? (
                    <>
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
                        </View>
                      ) : (
                        <Video
                          ref={videoRef}
                              source={{
                                uri: videoModal.mediaUrl,
                                headers: { "bypass-tunnel-reminder": "true" },
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
                            setVideoError("تعذر تشغيل الفيديو");
                            console.log("Video error (InfoScreen):", e);
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <Image
                      source={{ uri: videoModal.mediaUrl }}
                      style={styles.detailsImage}
                      resizeMode="cover"
                    />
                  )}
                </View>

                <View style={styles.detailsContent}>
                  <View style={styles.detailsHeaderRow}>
                    <View>
                      <Text style={styles.detailsTitle}>لحظتي</Text>
                      {!!videoModal.createdAt && (
                        <Text style={styles.detailsMeta}>
                          {new Date(videoModal.createdAt).toLocaleString()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.detailsLikes}>
                      <Ionicons name="thumbs-up" size={18} color={ACCENT_SOFT} />
                      <Text style={styles.detailsLikesText}>{videoModal.likeCount}</Text>
                    </View>
                  </View>

                  <View style={styles.detailsSectionHeader}>
                    <Text style={styles.detailsSectionTitle}>المعجبون بهذه اللحظة</Text>
                  </View>

                  {momentLikersLoading ? (
                    <View style={styles.detailsLikersLoading}>
                      <ActivityIndicator size="small" color={ACCENT_SOFT} />
                      <Text style={styles.detailsLikersLoadingText}>جاري تحميل المعجبين...</Text>
                    </View>
                  ) : momentLikersError ? (
                    <Text style={styles.detailsLikersError}>{momentLikersError}</Text>
                  ) : momentLikers.length === 0 ? (
                    <Text style={styles.detailsLikersEmpty}>لا يوجد معجبون بهذه اللحظة حتى الآن</Text>
                  ) : (
                    <ScrollView style={styles.detailsLikersList}>
                      {momentLikers.map((lk) => {
                        const lkFlag = lk.country ? getFlagEmoji(lk.country) : "";
                        const lkCountryName = lk.country ? getCountryName(lk.country) : "";
                        const genderBadgeStyle =
                          lk.gender === "male"
                            ? styles.genderBadgeMale
                            : lk.gender === "female"
                            ? styles.genderBadgeFemale
                            : null;
                        return (
                          <View key={lk.userId} style={styles.detailsLikerRow}>
                            <View style={styles.detailsLikerAvatarWrap}>
                              {lk.profileImage ? (
                                <Image source={{ uri: lk.profileImage }} style={styles.detailsLikerAvatar} />
                              ) : (
                                <View style={[styles.detailsLikerAvatar, styles.avatarSmallPlaceholder]}>
                                  <Ionicons name="person" size={20} color={TEXT_MUTED} />
                                </View>
                              )}
                            </View>
                            <View style={styles.detailsLikerInfo}>
                              <Text style={styles.detailsLikerName} numberOfLines={1}>
                                {lk.name}
                              </Text>
                              <View style={styles.detailsLikerMetaRow}>
                                {lk.age != null && genderBadgeStyle && (
                                  <View style={[styles.genderBadge, genderBadgeStyle]}>
                                    <Ionicons
                                      name={lk.gender === "male" ? "male" : "female"}
                                      size={12}
                                      color="#ffffff"
                                    />
                                    <Text style={styles.genderBadgeText}>{lk.age}</Text>
                                  </View>
                                )}
                                {lk.country && (
                                  <View style={styles.detailsLikerCountryRow}>
                                    {!!lkFlag && <Text style={styles.locationFlag}>{lkFlag}</Text>}
                                    <Text style={styles.locationText} numberOfLines={1}>
                                      {lkCountryName || lk.country}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            {lk.lastMediaUrl && (
                              <View style={styles.detailsLikerThumbWrap}>
                                <Image
                                  source={{ uri: lk.lastThumbnailUrl || lk.lastMediaUrl }}
                                  style={styles.detailsLikerThumb}
                                />
                                {lk.lastMediaType === "video" && (
                                  <View style={styles.detailsLikerThumbOverlay}>
                                    <Ionicons name="play" size={12} color="#ffffff" />
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              </Pressable>
            )}
            <TouchableOpacity style={styles.closeVideoBtn} onPress={closeVideo}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PURPLE_DARK,
    paddingTop: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 16, color: TEXT_LIGHT, fontWeight: "600" },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_LIGHT,
    textAlign: "center",
  },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  sliderWrap: { marginBottom: 20, paddingTop: 4 },
  sliderContent: {
    paddingHorizontal: CARD_MARGIN,
    gap: CARD_MARGIN,
  },
  slideCard: {
    width: CARD_WIDTH,
    height: SLIDER_HEIGHT,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(129, 140, 248, 0.6)",
  },
  slideImage: { width: "100%", height: "100%" },
  likeIconWrap: {
    position: "absolute",
    bottom: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  likeCountText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f5f3ff",
  },
  slidePlaceholder: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  slidePlaceholderText: {
    marginTop: 12,
    fontSize: 14,
    color: TEXT_MUTED,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT_MUTED,
  },
  dotActive: {
    width: 24,
    backgroundColor: ACCENT_SOFT,
  },
  tabRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
  },
  tabActive: {
    backgroundColor: "rgba(129, 140, 248, 0.95)",
    borderWidth: 0,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_MUTED,
  },
  tabTextActive: {
    color: "#0f172a",
    fontWeight: "700",
  },
  momentContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  momentTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 8,
  },
  momentSubtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  momentLoadingWrap: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
  },
  momentErrorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  momentEmptyWrap: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  momentEmptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_LIGHT,
  },
  momentEmptySub: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  momentList: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  momentCard: {
    width: (SCREEN_WIDTH - 20 * 2 - 12) / 2,
    marginBottom: 14,
    backgroundColor: ACCENT_MUTED_DARK,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.18)",
  },
  momentMediaWrap: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
  },
  momentImage: {
    width: "100%",
    height: "100%",
  },
  momentPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  momentInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  momentInfoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_LIGHT,
  },
  momentInfoMeta: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  momentLikesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  momentLikesText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
  momentDeleteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  videoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.95)",
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
    maxHeight: SCREEN_WIDTH * 1.7,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "rgba(24,20,37,0.98)",
  },
  videoPlayer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.9,
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
  detailsMediaWrap: {
    width: "100%",
    height: SCREEN_WIDTH * 0.9,
    backgroundColor: "black",
  },
  detailsImage: {
    width: "100%",
    height: "100%",
  },
  detailsContent: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  detailsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_LIGHT,
  },
  detailsMeta: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  detailsLikes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
  },
  detailsLikesText: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
  detailsSectionHeader: {
    marginTop: 12,
    marginBottom: 6,
  },
  detailsSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_MUTED,
  },
  detailsLikersLoading: {
    paddingVertical: 12,
    alignItems: "center",
    gap: 6,
  },
  detailsLikersLoadingText: {
    fontSize: 13,
    color: TEXT_MUTED,
  },
  detailsLikersError: {
    fontSize: 13,
    color: "#f87171",
    marginTop: 8,
  },
  detailsLikersEmpty: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 8,
  },
  detailsLikersList: {
    maxHeight: SCREEN_WIDTH * 0.9,
    marginTop: 6,
  },
  detailsLikerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.25)",
  },
  detailsLikerAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.5)",
    marginRight: 10,
  },
  detailsLikerAvatar: {
    width: "100%",
    height: "100%",
  },
  detailsLikerInfo: {
    flex: 1,
  },
  detailsLikerName: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 2,
  },
  detailsLikerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailsLikerCountryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailsLikerThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.4)",
    marginLeft: 8,
    position: "relative",
  },
  detailsLikerThumb: {
    width: "100%",
    height: "100%",
  },
  detailsLikerThumbOverlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
    gap: 16,
  },
  loadingText: { fontSize: 14, color: TEXT_MUTED },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
  },
  errorText: { fontSize: 13, color: TEXT_MUTED, flex: 1 },
  infoSections: { paddingBottom: 32, paddingTop: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(148, 163, 184, 0.95)",
    marginLeft: 20,
    marginBottom: 10,
    marginTop: 20,
    letterSpacing: 0.5,
  },
  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: ACCENT_MUTED_DARK,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.15)",
  },
  infoRowTouch: { minHeight: 1 },
});
