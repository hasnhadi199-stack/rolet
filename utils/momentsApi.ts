/**
 * واجهة لحظات — تتوقع من الباك اند:
 * GET  /api/moments         → { moments: Moment[] }
 * POST /api/moments         → FormData(media, mediaType, durationSeconds?, userId, userName, userAge) → { success, moment }
 * POST /api/moments/:id/like → { success, likeCount, likedByMe }
 * DELETE /api/moments/:id   → { success } (مالك اللحظة فقط — يحذف الملف من الخادم)
 * الفيديو: حد أقصى 20 ثانية (التحقق في الباك اند أيضاً).
 */
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./authHelper";

export type MomentMediaType = "image" | "video";

export type Moment = {
  id: string;
  userId: string;
  userName: string;
  userAge: number | null;
  userGender?: string | null;
  userCountry?: string | null;
  userProfileImage?: string | null;
  mediaUrl: string;
  thumbnailUrl?: string;
  mediaType: MomentMediaType;
  durationSeconds?: number;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
};

export type MomentLiker = {
  userId: string;
  name: string;
  age: number | null;
  profileImage?: string;
  country?: string;
  gender?: string;
  likeCount: number;
  lastMediaUrl?: string | null;
  lastThumbnailUrl?: string | null;
  lastMediaType?: MomentMediaType | null;
  lastLikedAt?: string | null;
};

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem("token");
}

const FALLBACK_URL = "http://localhost:3000";

async function tryFetchMoments(baseUrl: string, token: string | null): Promise<Moment[] | null> {
  try {
    const res = await axios.get(`${baseUrl}/api/moments`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 8000,
    });
    if (res.data?.moments) return res.data.moments as Moment[];
  } catch {}
  return null;
}

/**
 * جلب كل اللحظات (لجميع المستخدمين)
 * عند فشل المحاولة الأولى يحاول localhost:3000 كبديل.
 */
export async function fetchMoments(): Promise<Moment[]> {
  const token = await getAuthToken();
  let list = await tryFetchMoments(API_BASE_URL, token);
  if (!list) list = await tryFetchMoments(FALLBACK_URL, token);
  return list ?? [];
}

/**
 * نشر لحظة جديدة (صورة أو فيديو — الفيديو بحد أقصى 20 ثانية)
 */
export async function createMoment(params: {
  uri: string;
  mediaType: MomentMediaType;
  durationSeconds?: number;
  thumbnailUri?: string;
  userId: string;
  userName: string;
  userAge: number | null;
  userGender?: string | null;
  userCountry?: string | null;
  userProfileImage?: string | null;
}): Promise<Moment | null> {
  const token = await getAuthToken();
  if (!token) throw new Error("يجب تسجيل الدخول");

  const formData = new FormData();
  formData.append("media", {
    uri: params.uri,
    type: params.mediaType === "video" ? "video/mp4" : "image/jpeg",
    name: params.mediaType === "video" ? "moment.mp4" : "moment.jpg",
  } as any);
  formData.append("mediaType", params.mediaType);
  if (params.durationSeconds != null) formData.append("durationSeconds", String(params.durationSeconds));
  if (params.thumbnailUri) {
    formData.append("thumbnail", {
      uri: params.thumbnailUri,
      type: "image/jpeg",
      name: "thumbnail.jpg",
    } as any);
  }
  formData.append("userId", params.userId);
  formData.append("userName", params.userName);
  formData.append("userAge", params.userAge != null ? String(params.userAge) : "");
  if (params.userGender != null) formData.append("userGender", params.userGender || "");
  if (params.userCountry != null) formData.append("userCountry", params.userCountry || "");
  if (params.userProfileImage != null) formData.append("userProfileImage", params.userProfileImage || "");

  const tryPost = async (baseUrl: string) => {
    const res = await axios.post(`${baseUrl}/api/moments`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
      timeout: 30000,
    });
    if (res.data?.success && res.data?.moment) return res.data.moment as Moment;
    return null;
  };

  try {
    return await tryPost(API_BASE_URL);
  } catch (err: any) {
    if (err?.response?.status === 404) {
      try {
        return await tryPost(FALLBACK_URL);
      } catch {}
    }
    if (err?.response?.status === 404)
      throw new Error("خدمة اللحظات غير مفعّلة. تأكد أن الخادم يعمل وأن مسار /api/moments موجود.");
    if (err?.response?.status === 413)
      throw new Error("الملف كبير جداً أو الفيديو أطول من 20 ثانية.");
    throw err;
  }
}

/**
 * إعجاب أو إلغاء إعجاب بلحظة (مرة واحدة لكل مستخدم)
 */
export async function toggleMomentLike(momentId: string): Promise<{ likeCount: number; likedByMe: boolean } | null> {
  const token = await getAuthToken();
  if (!token) return null;
  const tryLike = async (baseUrl: string) => {
    const res = await axios.post(
      `${baseUrl}/api/moments/${momentId}/like`,
      {},
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
    );
    if (res.data?.success) return { likeCount: res.data.likeCount, likedByMe: res.data.likedByMe };
    return null;
  };
  try {
    return await tryLike(API_BASE_URL);
  } catch {
    try {
      return await tryLike(FALLBACK_URL);
    } catch {}
    return null;
  }
}

/**
 * حذف لحظة (مالك اللحظة فقط). عند النجاح تُحذف من الخادم والتطبيق مباشرة.
 */
export async function deleteMoment(momentId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  const tryDelete = async (baseUrl: string) => {
    const res = await axios.delete(`${baseUrl}/api/moments/${momentId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    return res.data?.success === true;
  };
  try {
    return await tryDelete(API_BASE_URL);
  } catch {
    try {
      return await tryDelete(FALLBACK_URL);
    } catch {}
    return false;
  }
}

/**
 * جلب المستخدمين الذين أعجبوا بلحظات المستخدم الحالي
 */
export async function fetchMyMomentLikers(): Promise<MomentLiker[]> {
  const token = await getAuthToken();
  if (!token) return [];

  const tryGet = async (baseUrl: string) => {
    const res = await axios.get(`${baseUrl}/api/moments/my-likers`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    if (res.data?.success && Array.isArray(res.data.users)) {
      return res.data.users as MomentLiker[];
    }
    return [];
  };

  try {
    return await tryGet(API_BASE_URL);
  } catch {
    try {
      return await tryGet(FALLBACK_URL);
    } catch {
      return [];
    }
  }
}

/**
 * جلب قائمة المعجبين بلحظة معينة (حسب معرف اللحظة)
 * المسار المتوقَّع في الباك اند:
 * GET /api/moments/:id/likers → { success: boolean, users: MomentLiker[] }
 */
export async function fetchMomentLikers(momentId: string): Promise<MomentLiker[]> {
  const token = await getAuthToken();
  if (!token) return [];

  const tryGet = async (baseUrl: string) => {
    const res = await axios.get(`${baseUrl}/api/moments/${momentId}/likers`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    if (res.data?.success && Array.isArray(res.data.users)) {
      return res.data.users as MomentLiker[];
    }
    return [];
  };

  try {
    return await tryGet(API_BASE_URL);
  } catch {
    try {
      return await tryGet(FALLBACK_URL);
    } catch {
      return [];
    }
  }
}
