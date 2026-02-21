import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  Dimensions,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import * as Localization from "expo-localization";
import { checkAuthStatus, API_BASE_URL } from "../utils/authHelper";
import { getFlagEmoji, getCountryName } from "../utils/countries";
import HomeScreen from "./screens/HomeScreen";
import MeScreen from "./screens/MeScreen";
import MessagesScreen from "./screens/MessagesScreen";
import ClubScreen from "./screens/ClubScreen";
import MomentScreen from "./screens/MomentScreen";

const { width } = Dimensions.get("window");

const PURPLE_DARK = "#1a1625";
const ACCENT = "#a78bfa";
const ACCENT_SOFT = "#c4b5fd";
const ACCENT_MUTED = "rgba(167, 139, 250, 0.25)";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const INPUT_BG = "rgba(255,255,255,0.05)";
const CARD_BG = "rgba(45, 38, 64, 0.6)";
const BORDER_SOFT = "rgba(167, 139, 250, 0.2)";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

type AuthState = "splash" | "email" | "pin" | "main";
type User = {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  age?: number | null;
  dateOfBirth?: string;
  height?: number | null;
  weight?: number | null;
  country?: string;
  gender?: string;
  hobby?: string;
  month?: string;
} | null;

function isProfileComplete(u: User): boolean {
  if (!u) return false;
  return (
    (typeof u.age === "number") ||
    (typeof u.height === "number") ||
    (typeof u.weight === "number") ||
    (u.gender !== "" && u.gender != null) ||
    (u.hobby !== "" && u.hobby != null) ||
    (u.dateOfBirth !== "" && u.dateOfBirth != null)
  );
}

function getDeviceCountryCode(): string {
  try {
    const locale = Localization.getLocales?.()?.[0] as { regionCode?: string; countryCode?: string } | undefined;
    const region = locale?.regionCode || locale?.countryCode || "";
    return region ? String(region).toUpperCase().slice(0, 2) : "";
  } catch {
    return "";
  }
}

function ageFromYearMonth(year: number, month: number): number {
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month) age -= 1;
  return age >= 0 ? age : 0;
}

function ProfileScreen({
  user,
  onUserUpdate,
  onBack,
}: {
  user: NonNullable<User>;
  onUserUpdate: (u: User) => void;
  onBack?: () => void;
}) {
  const deviceCountry = getDeviceCountryCode();
  const countryCode = user.country || deviceCountry || "";
  const isLocked =
    (typeof user.age === "number") ||
    (typeof user.height === "number") ||
    (typeof user.weight === "number") ||
    (user.gender !== "" && user.gender != null) ||
    (user.hobby !== "" && user.hobby != null) ||
    (user.dateOfBirth !== "" && user.dateOfBirth != null);

  const [name, setName] = useState(user.name || "");
  const [profileImage, setProfileImage] = useState(user.profileImage || "");
  const [height, setHeight] = useState(
    typeof user.height === "number" ? String(user.height) : ""
  );
  const [weight, setWeight] = useState(
    typeof user.weight === "number" ? String(user.weight) : ""
  );
  const [hobby, setHobby] = useState(user.hobby || "");
  const [gender, setGender] = useState(user.gender || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => currentYear - 79 + i).reverse();
  const [yearIndex, setYearIndex] = useState(() => {
    if (user.dateOfBirth) {
      const y = parseInt(user.dateOfBirth.slice(0, 4), 10);
      const idx = years.indexOf(y);
      return idx >= 0 ? idx : 0;
    }
    return years.indexOf(currentYear - 25) >= 0 ? years.indexOf(currentYear - 25) : 0;
  });
  const [monthIndex, setMonthIndex] = useState(() => {
    if (user.dateOfBirth) {
      const m = parseInt(user.dateOfBirth.slice(5, 7), 10);
      return m >= 1 && m <= 12 ? m - 1 : 0;
    }
    return 0;
  });

  const computedAge = ageFromYearMonth(years[yearIndex] ?? currentYear, (monthIndex ?? 0) + 1);
  const dateOfBirthStr =
    `${years[yearIndex]}-${String((monthIndex ?? 0) + 1).padStart(2, "0")}-01`;

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("يجب السماح بالوصول للصور");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const b64 = result.assets[0].base64;
      setProfileImage(b64 ? `data:image/jpeg;base64,${b64}` : uri);
    }
  }, []);

  const saveProfile = useCallback(async () => {
    setError("");
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setError("انتهت الجلسة");
        setSaving(false);
        return;
      }
      const payload: Record<string, unknown> = {
        name: name.trim() || user.name,
        profileImage: profileImage || user.profileImage,
      };
      if (!isLocked) {
        payload.height = height === "" ? null : Number(height);
        payload.weight = weight === "" ? null : Number(weight);
        payload.hobby = hobby.trim() || "";
        payload.gender = gender || "";
        payload.dateOfBirth = dateOfBirthStr;
        payload.age = computedAge;
        payload.country = countryCode || deviceCountry || "";
        payload.month = String((monthIndex ?? 0) + 1);
      }
      const res = await axios.put(`${API_BASE_URL}/api/auth/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 12000,
      });
      if (res.data?.success && res.data?.user) {
        onUserUpdate(res.data.user);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        "فشل الحفظ";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [
    name,
    profileImage,
    height,
    weight,
    hobby,
    gender,
    dateOfBirthStr,
    computedAge,
    countryCode,
    deviceCountry,
    monthIndex,
    isLocked,
    user,
    onUserUpdate,
  ]);

  return (
    <View style={styles.mainContainer}>
      <ScrollView
        style={styles.profileScroll}
        contentContainerStyle={styles.profileScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileTitleRow}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} style={styles.backToTabsBtn} activeOpacity={0.8}>
                <Ionicons name="arrow-forward" size={22} color={ACCENT_SOFT} />
                <Text style={styles.backToTabsText}>رجوع</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.profileTitle}>الملف الشخصي</Text>
          </View>

          {/* اسم + صورة + دولة وعلم */}
          <View style={styles.rowNameImage}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarWrap} activeOpacity={0.8}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>+</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.nameCountryWrap}>
              <TextInput
                style={styles.inputName}
                value={name}
                onChangeText={setName}
                placeholder="الاسم"
                placeholderTextColor={TEXT_MUTED}
              />
              <View style={styles.countryRow}>
                <Text style={styles.flagText}>{getFlagEmoji(countryCode)}</Text>
                <Text style={styles.countryName} numberOfLines={1}>
                  {getCountryName(countryCode) || "حسب موقع جهازك"}
                </Text>
              </View>
            </View>
          </View>

          {!isLocked && (
            <>
              <Text style={styles.label}>الطول (سم)</Text>
              <TextInput
                style={styles.input}
                value={height}
                onChangeText={setHeight}
                placeholder="مثال: 170"
                placeholderTextColor={TEXT_MUTED}
                keyboardType="number-pad"
              />
              <Text style={styles.label}>الوزن (كغ)</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                placeholder="مثال: 70"
                placeholderTextColor={TEXT_MUTED}
                keyboardType="number-pad"
              />
              <Text style={styles.label}>الهوايات (مثل كيم وغيرها)</Text>
              <TextInput
                style={styles.input}
                value={hobby}
                onChangeText={setHobby}
                placeholder="أدخل هواياتك"
                placeholderTextColor={TEXT_MUTED}
              />
              <Text style={styles.label}>شهر وسنة الميلاد</Text>
              <View style={styles.rowMonthYear}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  {MONTHS.map((m, i) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.pickerChip, monthIndex === i && styles.pickerChipActive]}
                      onPress={() => setMonthIndex(i)}
                    >
                      <Text style={[styles.pickerChipText, monthIndex === i && styles.pickerChipTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  {years.map((y, i) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.pickerChip, yearIndex === i && styles.pickerChipActive]}
                      onPress={() => setYearIndex(i)}
                    >
                      <Text style={[styles.pickerChipText, yearIndex === i && styles.pickerChipTextActive]}>
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Text style={styles.label}>العمر (يُحسب تلقائياً): {computedAge}</Text>

              <Text style={styles.label}>الجنس</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity
                  style={[styles.genderBtn, gender === "male" && styles.genderBtnActive]}
                  onPress={() => setGender("male")}
                >
                  <Text style={styles.genderIcon}>♂</Text>
                  <Text style={[styles.genderLabel, gender === "male" && styles.genderLabelActive]}>ذكر</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genderBtn, gender === "female" && styles.genderBtnActive]}
                  onPress={() => setGender("female")}
                >
                  <Text style={styles.genderIcon}>♀</Text>
                  <Text style={[styles.genderLabel, gender === "female" && styles.genderLabelActive]}>أنثى</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {isLocked && (
            <Text style={styles.lockedHint}>يمكنك تعديل الاسم والصورة فقط.</Text>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
            onPress={saveProfile}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={PURPLE_DARK} />
            ) : (
              <Text style={styles.primaryBtnText}>{isLocked ? "حفظ التعديلات" : "حفظ البيانات"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

type TabId = "home" | "me" | "messages" | "club" | "moment";

const TAB_THEMES: Record<TabId, { bg: string; color: string; border: string; shadow: string }> = {
  moment: {
    bg: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
    color: "#FF6B00",
    border: "#FFD700",
    shadow: "#FFD700",
  },
  messages: {
    bg: "linear-gradient(135deg, #00D4FF 0%, #5B7FFF 100%)",
    color: "#0066FF",
    border: "#00D4FF",
    shadow: "#00D4FF",
  },
  club: {
    bg: "linear-gradient(135deg, #00FF87 0%, #00D68F 100%)",
    color: "#00B377",
    border: "#00FF87",
    shadow: "#00FF87",
  },
  home: {
    bg: "linear-gradient(135deg, #FF6B9D 0%, #FF3D7F 100%)",
    color: "#FF1F6B",
    border: "#FF6B9D",
    shadow: "#FF6B9D",
  },
  me: {
    bg: "linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)",
    color: "#8B5CF6",
    border: "#A855F7",
    shadow: "#A855F7",
  },
};

const TABS: { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap; emoji: string }[] = [
  { id: "moment", label: "لحظة", icon: "flash", emoji: "⚡" },
  { id: "messages", label: "رسائل", icon: "chatbubbles", emoji: "💬" },
  { id: "club", label: "نادي", icon: "people", emoji: "🎯" },
  { id: "home", label: "الرئيسية", icon: "home", emoji: "🏠" },
  { id: "me", label: "أنا", icon: "person", emoji: "👤" },
];

function TabIcon({
  tab,
  active,
  onPress,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const theme = TAB_THEMES[tab.id];

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.8, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, rotateAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 3, tension: 200 }),
      Animated.timing(rotateAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, rotateAnim]);

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.5, duration: 800, useNativeDriver: false }),
        ])
      ).start();
    } else {
      glowAnim.setValue(0);
    }
  }, [active, glowAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-8deg"],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
    >
      <Animated.View
        style={[
          styles.tabIconWrap,
          { transform: [{ scale: scaleAnim }, { rotate: rotation }] },
        ]}
      >
        {active && (
          <Animated.View
            style={[
              styles.tabGlow,
              {
                backgroundColor: theme.shadow,
                opacity: glowAnim,
              },
            ]}
          />
        )}
        <View
          style={[
            styles.tabIconBubble,
            active && {
              backgroundColor: theme.border,
              borderColor: theme.border,
              shadowColor: theme.shadow,
              shadowOpacity: 0.8,
              shadowRadius: 12,
              elevation: 8,
            },
          ]}
        >
          <Ionicons
            name={active ? tab.icon : (`${tab.icon}-outline` as keyof typeof Ionicons.glyphMap)}
            size={24}
            color={active ? "#FFFFFF" : TEXT_MUTED}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            active && { color: theme.color, fontWeight: "800" },
          ]}
        >
          {tab.label}
        </Text>
        {active && <View style={[styles.tabDot, { backgroundColor: theme.color }]} />}
      </Animated.View>
    </Pressable>
  );
}

function MainTabsScreen({
  user,
  onEditProfile,
}: {
  user: NonNullable<User>;
  onEditProfile: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("home");

  return (
    <View style={styles.tabsContainer}>
      <View style={styles.tabsContent}>
        {activeTab === "home" && (
          <HomeScreen userName={user.name || ""} onNavigate={(t) => setActiveTab(t as TabId)} />
        )}
        {activeTab === "me" && (
          <MeScreen user={user} onEditProfile={onEditProfile} />
        )}
        {activeTab === "messages" && <MessagesScreen />}
        {activeTab === "club" && <ClubScreen />}
        {activeTab === "moment" && <MomentScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TabIcon
            key={tab.id}
            tab={tab}
            active={activeTab === tab.id}
            onPress={() => setActiveTab(tab.id)}
          />
        ))}
      </View>
    </View>
  );
}

export default function Page() {
  const [authState, setAuthState] = useState<AuthState>("splash");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [user, setUser] = useState<User>(null);
  const [authResult, setAuthResult] = useState<Awaited<ReturnType<typeof checkAuthStatus>> | null>(null);
  const [splashDone, setSplashDone] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pinRefs = useRef<(TextInput | null)[]>([]);

  // ——— التحقق من الجلسة عند فتح التطبيق (يبقى مسجّل بعد الإغلاق أو إعادة التحميل) ———
  useEffect(() => {
    checkAuthStatus().then(setAuthResult);
  }, []);

  // ——— Splash ثم الانتقال لمباشر للرئيسية أو تسجيل الدخول ———
  useEffect(() => {
    if (authState !== "splash") return;
    const t = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setSplashDone(true));
    }, 3500);
    return () => clearTimeout(t);
  }, [authState, fadeAnim]);

  // ——— بعد انتهاء السبلاش: الانتقال للرئيسية إن وُجد توكن صالح، وإلا شاشة تسجيل الدخول ———
  useEffect(() => {
    if (!splashDone || authResult === null) return;
    if (authResult.authenticated && authResult.user) {
      setUser(authResult.user as User);
      setAuthState("main");
    } else {
      setAuthState("email");
    }
  }, [splashDone, authResult]);

  // ——— عند ظهور شاشة البريد: تحقق إضافي (مثلاً إذا رجع من الشاشة الرئيسية) ———
  useEffect(() => {
    if (authState !== "email") return;
    let cancelled = false;
    checkAuthStatus().then((r) => {
      if (cancelled) return;
      if (r.authenticated && r.user) {
        setUser(r.user as User);
        setAuthState("main");
      }
    });
    return () => { cancelled = true; };
  }, [authState]);

  const requestPin = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("أدخل بريدك الإلكتروني أو Gmail");
      return;
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(trimmed)) {
      setError("أدخل بريداً إلكترونياً صحيحاً");
      return;
    }
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/request-pin`,
        { email: trimmed },
        { timeout: 12000 }
      );
      if (res.data?.success) {
        setEmail(trimmed);
        setSuccessMsg("تم إرسال الكود إلى بريدك");
        setAuthState("pin");
        setPin(["", "", "", "", "", ""]);
        setTimeout(() => pinRefs.current[0]?.focus(), 300);
      } else {
        setError(res.data?.message || "فشل إرسال الكود");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        "تحقق من الاتصال وحاول مرة أخرى";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [email]);

  const verifyPin = useCallback(async () => {
    const pinStr = pin.join("");
    if (pinStr.length !== 6) {
      setError("أدخل الكود المكوّن من 6 أرقام");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/verify-pin`,
        { email: email.trim().toLowerCase(), pin: pinStr },
        { timeout: 12000 }
      );
      if (res.data?.success && res.data.token && res.data.user) {
        await AsyncStorage.setItem("token", res.data.token);
        await AsyncStorage.setItem("user", JSON.stringify(res.data.user));
        setUser(res.data.user);
        setAuthState("main");
      } else {
        setError(res.data?.message || "فشل التحقق");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        "تحقق من الكود والاتصال";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [email, pin]);

  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const next = [...pin];
      digits.forEach((d, i) => {
        if (index + i < 6) next[index + i] = d;
      });
      setPin(next);
      const nextIdx = Math.min(index + digits.length, 5);
      pinRefs.current[nextIdx]?.focus();
      return;
    }
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...pin];
    next[index] = digit;
    setPin(next);
    if (digit && index < 5) pinRefs.current[index + 1]?.focus();
  };

  const handlePinKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  const resendPin = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/request-pin`,
        { email: email.trim().toLowerCase() },
        { timeout: 12000 }
      );
      if (res.data?.success) {
        setSuccessMsg("تم إعادة إرسال الكود");
        setPin(["", "", "", "", "", ""]);
        pinRefs.current[0]?.focus();
      } else {
        setError(res.data?.message || "فشل إعادة الإرسال");
      }
    } catch {
      setError("تحقق من الاتصال وحاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  }, [email]);

  // ——— شاشة البداية (Splash) ———
  if (authState === "splash") {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
        <View style={styles.splashContent}>
          <LottieView
            source={require("../assets/images/3D Treasure Box (1).json")}
            autoPlay
            loop={false}
            style={styles.lottie}
          />
        </View>
      </Animated.View>
    );
  }

  // ——— الشاشة الرئيسية: تبويبات (أنا، رسائل، نادي، لحظة) أو صفحة الملف إذا غير مكتمل ———
  if (authState === "main" && user) {
    const profileComplete = isProfileComplete(user);
    if (showProfileEdit || !profileComplete) {
      return (
        <ProfileScreen
          user={user}
          onUserUpdate={setUser}
          onBack={profileComplete ? () => setShowProfileEdit(false) : undefined}
        />
      );
    }
    return (
      <MainTabsScreen
        user={user}
        onEditProfile={() => setShowProfileEdit(true)}
      />
    );
  }

  // ——— تسجيل الدخول: البريد ثم الكود ———
  const isPinStep = authState === "pin";

  return (
    <KeyboardAvoidingView
      style={styles.loginContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
    >
      <View style={styles.loginInner}>
        {/* أنيميشن صندوق الكنز فوق النموذج */}
        <View style={styles.lottieWrap}>
          <LottieView
            source={require("../assets/images/3D Treasure Box (1).json")}
            autoPlay
            loop
            style={styles.loginLottie}
          />
        </View>

        <View style={styles.loginHeader}>
          <Text style={styles.loginTitle}>
            {isPinStep ? "أدخل الكود" : "تسجيل الدخول"}
          </Text>
          <Text style={styles.loginSub}>
            {isPinStep
              ? `تم إرسال كود مكوّن من 6 أرقام إلى ${email}`
              : "أدخل بريدك الإلكتروني أو Gmail وسنرسل لك كوداً للدخول"}
          </Text>
        </View>

        {/* محتوى بدون كارت — إطار ذهبي فقط */}
        <View style={styles.goldFrame}>
          {!isPinStep ? (
            <>
              <Text style={styles.label}>البريد الإلكتروني</Text>
              <TextInput
                style={styles.input}
                placeholder="example@gmail.com"
                placeholderTextColor={TEXT_MUTED}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(""); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={requestPin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#0d1b2a" />
                ) : (
                  <Text style={styles.primaryBtnText}>إرسال الكود</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.pinRow}>
                {pin.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { pinRefs.current[i] = r; }}
                    style={[styles.pinBox, digit ? styles.pinBoxFilled : null]}
                    value={digit}
                    onChangeText={(v) => handlePinChange(i, v)}
                    onKeyPress={({ nativeEvent }) => handlePinKeyPress(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={6}
                    selectTextOnFocus
                    editable={!loading}
                  />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={verifyPin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#0d1b2a" />
                ) : (
                  <Text style={styles.primaryBtnText}>تأكيد الدخول</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resendBtn}
                onPress={resendPin}
                disabled={loading}
              >
                <Text style={styles.resendText}>إعادة إرسال الكود</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => { setAuthState("email"); setError(""); setSuccessMsg(""); }}
                disabled={loading}
              >
                <Text style={styles.backBtnText}>تغيير البريد</Text>
              </TouchableOpacity>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: PURPLE_DARK,
    justifyContent: "center",
    alignItems: "center",
  },
  splashContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  lottie: {
    width: width * 0.7,
    height: width * 0.7,
    maxWidth: 320,
    maxHeight: 320,
  },
  loginContainer: {
    flex: 1,
    backgroundColor: PURPLE_DARK,
  },
  loginInner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  lottieWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  loginLottie: {
    width: width * 0.36,
    height: width * 0.36,
    maxWidth: 130,
    maxHeight: 130,
  },
  loginHeader: {
    marginBottom: 16,
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: TEXT_LIGHT,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  loginSub: {
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 20,
  },
  goldFrame: {
    borderRadius: 20,
    padding: 20,
  },
  label: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 8,
    fontWeight: "400",
  },
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: TEXT_LIGHT,
    borderWidth: 0,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderWidth: 0,
  },
  primaryBtnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    color: PURPLE_DARK,
    fontSize: 14,
    fontWeight: "600",
  },
  pinRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 8,
  },
  pinBox: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 44,
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    borderWidth: 0,
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_LIGHT,
    textAlign: "center",
  },
  pinBoxFilled: {
    backgroundColor: ACCENT_MUTED,
  },
  resendBtn: {
    marginTop: 14,
    alignItems: "center",
  },
  resendText: {
    color: ACCENT_SOFT,
    fontSize: 13,
    fontWeight: "500",
  },
  backBtn: {
    marginTop: 10,
    alignItems: "center",
  },
  backBtnText: {
    color: TEXT_MUTED,
    fontSize: 12,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 12,
    marginTop: 14,
    textAlign: "center",
  },
  successText: {
    color: "#86efac",
    fontSize: 12,
    marginTop: 14,
    textAlign: "center",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: PURPLE_DARK,
  },
  profileScroll: {
    flex: 1,
  },
  profileScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileCard: {
    padding: 20,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_LIGHT,
    marginBottom: 20,
  },
  rowNameImage: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 16,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    backgroundColor: INPUT_BG,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: 28,
    color: TEXT_MUTED,
  },
  nameCountryWrap: {
    flex: 1,
  },
  inputName: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_LIGHT,
    marginBottom: 8,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flagText: {
    fontSize: 18,
  },
  countryName: {
    fontSize: 12,
    color: TEXT_MUTED,
    flex: 1,
  },
  rowMonthYear: {
    flexDirection: "column",
    gap: 10,
    marginBottom: 12,
  },
  pickerScroll: {
    maxHeight: 44,
    marginBottom: 4,
  },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: INPUT_BG,
    marginHorizontal: 4,
    alignSelf: "flex-start",
  },
  pickerChipActive: {
    backgroundColor: ACCENT_MUTED,
  },
  pickerChipText: {
    fontSize: 13,
    color: TEXT_LIGHT,
  },
  pickerChipTextActive: {
    color: ACCENT_SOFT,
    fontWeight: "600",
  },
  genderRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: INPUT_BG,
    alignItems: "center",
  },
  genderBtnActive: {
    backgroundColor: ACCENT_MUTED,
  },
  genderIcon: {
    fontSize: 24,
    color: TEXT_LIGHT,
    marginBottom: 4,
  },
  genderLabel: {
    fontSize: 13,
    color: TEXT_MUTED,
  },
  genderLabelActive: {
    color: ACCENT_SOFT,
    fontWeight: "600",
  },
  lockedHint: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 16,
  },
  profileTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  backToTabsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backToTabsText: {
    fontSize: 14,
    color: ACCENT_SOFT,
    fontWeight: "500",
  },
  tabsContainer: {
    flex: 1,
    backgroundColor: PURPLE_DARK,
  },
  tabsContent: {
    flex: 1,
    paddingBottom: 1,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 4,
    paddingHorizontal: 14,
    paddingBottom:1,
    marginHorizontal: 14,
    marginBottom: Platform.OS === "ios" ? 0 : 43,
    backgroundColor: CARD_BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: -6,
  },
  tabIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabGlow: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    top: -4,
    zIndex: -1,
  },
  tabIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "transparent",
    shadowOffset: { width: 0, height: 4 },
  },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: "500",
    marginTop: 4,
  },
});
