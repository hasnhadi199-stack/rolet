import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

// يجب أن يتطابق مع عنوان الخادم. غيّره حسب بيئة التشغيل:
// - Scalingo (إنتاج): "https://hasnhadiabdali.osc-fr1.scalingo.io"
// - محلي (Cloudflare): "https://xxx.trycloudflare.com"
// - Railway (إنتاج): "https://web-production-c85b1.up.railway.app"
// - محلي (محاكي): "http://localhost:3000"
// - أندرويد محاكي: "http://10.0.2.2:3000"
export const API_BASE_URL = "https://web-production-c85b1.up.railway.app";

// عند استخدام loca.lt — تجاوز صفحة "Click to Continue" حتى يعمل التطبيق على الجوال
if (API_BASE_URL.includes("loca.lt")) {
  axios.interceptors.request.use((config) => {
    if (config.url && config.url.includes("loca.lt")) {
      config.headers = config.headers || {};
      config.headers["Bypass-Tunnel-Reminder"] = "yup";
    }
    return config;
  });
}

/**
 * فك تشفير JWT token بدون مكتبة (للتحقق من انتهاء الصلاحية فقط)
 * ملاحظة: هذا لا يتحقق من التوقيع، فقط من الصيغة والوقت
 */
function decodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * التحقق من أن التوكن لم ينتهِ صلاحيته (محلياً)
 */
function isTokenExpired(token) {
  if (!token) return true;

  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;

  // التحقق من انتهاء الصلاحية (مع هامش 5 دقائق للأمان)
  const now = Math.floor(Date.now() / 1000);
  const expirationTime = decoded.exp;
  const margin = 5 * 60; // 5 دقائق

  return now >= expirationTime - margin;
}

/**
 * التحقق من صحة البيانات المحفوظة
 */
function validateStoredData(user) {
  if (!user) return false;
  const userId = user?.id ? String(user.id) : null;
  return Boolean(userId && userId.length >= 8 && /^\d+$/.test(userId));
}

/**
 * محاولة التحقق من السيرفر مع retry mechanism
 */
async function verifyTokenWithServer(token, retries = 0) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        // أسرع: لا نريد أن يعلّق تسجيل الدخول على شبكة بطيئة
        timeout: 2500,
      });

      if (res.data?.success && res.data?.user) {
        return { success: true, user: res.data.user };
      }
    } catch (error) {
      const status = error?.response?.status;
      const isTimeout = error?.code === "ECONNABORTED" || status === 408;

      // إذا كان timeout أو خطأ شبكة: لا نؤخر فتح التطبيق — نستخدم fallback مباشرة
      if (i < retries && (isTimeout || status >= 500)) continue;

      // 401 أو 403 = توكن غير صالح
      if (status === 401 || status === 403) {
        return { success: false, reason: "invalid_token" };
      }

      // 404 = المسار غير موجود على الخادم — نستخدم البيانات المحلية بدل تسجيل الخروج
      if (status === 404) {
        return { success: false, reason: "network_error" };
      }

      // خطأ شبكة أو timeout - نرجع null للسماح بالfallback
      if (isTimeout || status >= 500) {
        return { success: false, reason: "network_error" };
      }
    }
  }

  return { success: false, reason: "network_error" };
}

/**
 * تحقق سريع من المصادقة — من AsyncStorage فقط (بدون استدعاء API)
 * يُستخدم لعرض التطبيق فوراً عند الفتح أو العودة
 */
export async function checkAuthStatusQuick() {
  try {
    const [token, userStr] = await Promise.all([
      AsyncStorage.getItem("token"),
      AsyncStorage.getItem("user"),
    ]);
    if (!token || !userStr) return { authenticated: false, reason: "no_data" };
    let user;
    try {
      user = JSON.parse(userStr);
    } catch {
      return { authenticated: false, reason: "invalid_data" };
    }
    if (!validateStoredData(user)) return { authenticated: false, reason: "invalid_user" };
    if (isTokenExpired(token)) {
      await AsyncStorage.multiRemove(["token", "user", "userId", "authEmail"]);
      return { authenticated: false, reason: "expired_token" };
    }
    return { authenticated: true, user, offline: true };
  } catch {
    return { authenticated: false, reason: "error" };
  }
}

/**
 * التحقق الكامل من تسجيل الدخول مع fallback mechanism
 */
export async function checkAuthStatus() {
  try {
    const [token, userStr] = await Promise.all([
      AsyncStorage.getItem("token"),
      AsyncStorage.getItem("user"),
    ]);

    if (!token || !userStr) {
      return { authenticated: false, reason: "no_data" };
    }

    let user;
    try {
      user = JSON.parse(userStr);
    } catch {
      return { authenticated: false, reason: "invalid_data" };
    }

    // التحقق من صحة البيانات المحفوظة
    if (!validateStoredData(user)) {
      return { authenticated: false, reason: "invalid_user" };
    }

    // التحقق المحلي من انتهاء صلاحية التوكن
    if (isTokenExpired(token)) {
      // التوكن منتهي - مسح البيانات
      await AsyncStorage.multiRemove(["token", "user", "userId", "authEmail"]);
      return { authenticated: false, reason: "expired_token" };
    }

    // محاولة التحقق من السيرفر (سريعة وبدون retries افتراضياً)
    const serverCheck = await verifyTokenWithServer(token, 0);

    if (serverCheck.success) {
      // تحديث بيانات المستخدم إذا تغيرت
      if (serverCheck.user) {
        await AsyncStorage.setItem("user", JSON.stringify(serverCheck.user));
      }
      return { authenticated: true, user: serverCheck.user || user };
    }

    // إذا كان الخطأ من الشبكة (timeout/500)، نستخدم البيانات المحلية
    if (serverCheck.reason === "network_error") {
      // التوكن محلياً صالح - نستخدم البيانات المحفوظة
      return { authenticated: true, user, offline: true };
    }

    // التوكن غير صالح فعلياً (401/403)
    if (serverCheck.reason === "invalid_token") {
      await AsyncStorage.multiRemove(["token", "user", "userId", "authEmail"]);
      return { authenticated: false, reason: "invalid_token" };
    }

    // حالة افتراضية - نستخدم البيانات المحلية إذا كان التوكن محلياً صالحاً
    return { authenticated: true, user, offline: true };
  } catch (error) {
    console.error("Auth check error:", error);
    return { authenticated: false, reason: "error" };
  }
}

/**
 * مسح الحساب من الباك اند — يتطلب توكن صالح
 */
export async function deleteAccount() {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return { success: false, reason: "no_token" };

    const res = await axios.delete(`${API_BASE_URL}/api/auth/account`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    if (res.data?.success) {
      await AsyncStorage.multiRemove(["token", "user", "userId", "authEmail"]);
      return { success: true };
    }
    return { success: false, reason: res.data?.message || "unknown" };
  } catch (err) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || err?.message;
    if (status === 401 || status === 403) {
      await AsyncStorage.multiRemove(["token", "user", "userId", "authEmail"]);
      return { success: false, reason: "invalid_token" };
    }
    return { success: false, reason: msg || "network_error" };
  }
}
