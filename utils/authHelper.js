import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

// يجب أن يتطابق مع عنوان الخادم. غيّره حسب بيئة التشغيل:
// - محلي (نفق loca.lt): "https://myapi123.loca.lt"
// - محلي (محاكي): "http://localhost:3000"
// - أندرويد محاكي: "http://10.0.2.2:3000"
export const API_BASE_URL = "https://myapi123.loca.lt";

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
async function verifyTokenWithServer(token, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000, // زيادة timeout إلى 8 ثواني
      });

      if (res.data?.success && res.data?.user) {
        return { success: true, user: res.data.user };
      }
    } catch (error) {
      const status = error?.response?.status;
      const isTimeout = error?.code === "ECONNABORTED" || status === 408;

      // إذا كان timeout أو خطأ شبكة، نجرب مرة أخرى
      if (i < retries && (isTimeout || status >= 500)) {
        // انتظار متزايد (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, (i + 1) * 1000));
        continue;
      }

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

    // محاولة التحقق من السيرفر
    const serverCheck = await verifyTokenWithServer(token);

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
