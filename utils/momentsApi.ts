/**
 * واجهة لحظات — تتوقع من الباك اند:
 * GET  /api/moments         → { moments: Moment[] }
 * POST /api/moments         → FormData(media, mediaType, durationSeconds?, userId, userName, userAge) → { success, moment }
 * POST /api/moments/:id/like → { success, likeCount, likedByMe } (مرة واحدة لكل مستخدم)
 * الفيديو: حد أقصى 13 ثانية (التحقق في الباك اند أيضاً).
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
  mediaUrl: string;
  mediaType: MomentMediaType;
  durationSeconds?: number;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
};

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem("token");
}

/**
 * جلب كل اللحظات (لجميع المستخدمين)
 * عند 404 أو خطأ شبكة يُرجع مصفوفة فارغة ولا يرمي خطأ.
 */
export async function fetchMoments(): Promise<Moment[]> {
  try {
    const token = await getAuthToken();
    const res = await axios.get(`${API_BASE_URL}/api/moments`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 12000,
    });
    if (!res.data?.moments) return [];
    return res.data.moments as Moment[];
  } catch (err: any) {
    if (err?.response?.status === 404) return [];
    if (err?.code === "ECONNABORTED" || err?.message?.includes("Network")) return [];
    return [];
  }
}

/**
 * نشر لحظة جديدة (صورة أو فيديو — الفيديو بحد أقصى 13 ثانية)
 */
export async function createMoment(params: {
  uri: string;
  mediaType: MomentMediaType;
  durationSeconds?: number;
  userId: string;
  userName: string;
  userAge: number | null;
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
  formData.append("userId", params.userId);
  formData.append("userName", params.userName);
  formData.append("userAge", params.userAge != null ? String(params.userAge) : "");

  try {
    const res = await axios.post(`${API_BASE_URL}/api/moments`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
      timeout: 30000,
    });
    if (res.data?.success && res.data?.moment) return res.data.moment as Moment;
    return null;
  } catch (err: any) {
    if (err?.response?.status === 404)
      throw new Error("خدمة اللحظات غير مفعّلة على الخادم بعد (404).");
    if (err?.response?.status === 413)
      throw new Error("الملف كبير جداً أو الفيديو أطول من 13 ثانية.");
    throw err;
  }
}

/**
 * إعجاب أو إلغاء إعجاب بلحظة (مرة واحدة لكل مستخدم)
 */
export async function toggleMomentLike(momentId: string): Promise<{ likeCount: number; likedByMe: boolean } | null> {
  const token = await getAuthToken();
  if (!token) return null;
  try {
    const res = await axios.post(
      `${API_BASE_URL}/api/moments/${momentId}/like`,
      {},
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
    );
    if (res.data?.success) return { likeCount: res.data.likeCount, likedByMe: res.data.likedByMe };
    return null;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    return null;
  }
}
