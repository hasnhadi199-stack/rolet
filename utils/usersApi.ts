/**
 * واجهة البحث عن المستخدمين — تتوقع من الباك اند:
 * GET /api/users/search?q=ID → { success, users: UserSearchResult[] }
 */
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./authHelper";

export type UserSearchResult = {
  id: string;
  name: string;
  profileImage: string;
  age: number | null;
  country: string;
  gender: string;
  height?: number | null;
  weight?: number | null;
};

export async function searchUsersById(query: string): Promise<UserSearchResult[]> {
  const q = String(query || "").trim();
  if (!q) return [];

  const token = await AsyncStorage.getItem("token");
  const res = await axios.get(`${API_BASE_URL}/api/users/search`, {
    params: { q },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeout: 8000,
  });

  if (res.data?.success && Array.isArray(res.data.users)) {
    const users = res.data.users as UserSearchResult[];
    const base = API_BASE_URL.replace(/\/$/, "");
    return users.map((u) => {
      const img = u.profileImage || "";
      // رابط كامل (Google) أو base64 — نستخدمه كما هو
      if (img.startsWith("http") || img.startsWith("data:")) {
        return { ...u, profileImage: img };
      }
      // اسم ملف محفوظ في uploads
      if (img) {
        return { ...u, profileImage: `${base}/uploads/${img.replace(/^\//, "")}` };
      }
      return { ...u, profileImage: "" };
    });
  }
  return [];
}
