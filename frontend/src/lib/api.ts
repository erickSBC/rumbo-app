/**
 * Helper para llamar al backend Express desde el cliente.
 * Adjunta el ID token de Firebase (si hay sesión) en Authorization: Bearer.
 * El backend deriva el empresaId de ese token — el cliente nunca lo envía.
 */
import { auth } from "./firebase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  }
  return data as T;
}
