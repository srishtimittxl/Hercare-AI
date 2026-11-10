import Constants from "expo-constants";
import { Platform } from "react-native";

let cachedWorkingBase: string | null = null;

function isValidEnvValue(val: string | undefined): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.length > 0 &&
    trimmed !== "undefined" &&
    trimmed !== "null" &&
    !trimmed.startsWith("$")
  );
}

export function getCandidateApiBases(): string[] {
  const candidates: string[] = [];

  const addCandidate = (url: string) => {
    const clean = url.replace(/\/+$/, "");
    if (clean && !candidates.includes(clean)) {
      candidates.push(clean);
    }
  };

  // 1. Explicit EXPO_PUBLIC_API_URL
  if (isValidEnvValue(process.env.EXPO_PUBLIC_API_URL)) {
    addCandidate(process.env.EXPO_PUBLIC_API_URL.trim());
  }

  // 2. EXPO_PUBLIC_DOMAIN (only when genuinely set)
  if (isValidEnvValue(process.env.EXPO_PUBLIC_DOMAIN)) {
    const domain = process.env.EXPO_PUBLIC_DOMAIN.trim();
    if (domain.startsWith("http://") || domain.startsWith("https://")) {
      addCandidate(domain);
    } else {
      const isLocal =
        domain.startsWith("localhost") ||
        domain.startsWith("127.0.0.1") ||
        /^\d+\.\d+\.\d+\.\d+/.test(domain);
      addCandidate(`${isLocal ? "http" : "https"}://${domain}`);
    }
  }

  // 3. Web browser hostname
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    addCandidate(`http://${window.location.hostname}:5001`);
  }

  // 4. Expo Go / Native packager hostUri LAN IP
  if (Platform.OS !== "web") {
    const hostUri =
      Constants.expoConfig?.hostUri ??
      (
        Constants as unknown as {
          manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
        }
      ).manifest2?.extra?.expoClient?.hostUri;
    if (hostUri) {
      const hostIp = hostUri.split(":")[0];
      if (hostIp) {
        addCandidate(`http://${hostIp}:5001`);
      }
    }
  }

  // 5. Standard local loopback addresses (Web, iOS Simulator, Android Emulator)
  addCandidate("http://localhost:5001");
  addCandidate("http://127.0.0.1:5001");
  if (Platform.OS === "android") {
    addCandidate("http://10.0.2.2:5001");
  }

  return candidates;
}

export function resolveApiBase(): string {
  if (cachedWorkingBase) return cachedWorkingBase;
  const candidates = getCandidateApiBases();
  return candidates[0] ?? "http://localhost:5001";
}

export async function discoverWorkingApiBase(): Promise<{
  online: boolean;
  baseUrl: string;
}> {
  const candidates = getCandidateApiBases();
  // If we already found a working base, check it first
  if (cachedWorkingBase && candidates.includes(cachedWorkingBase)) {
    candidates.splice(candidates.indexOf(cachedWorkingBase), 1);
    candidates.unshift(cachedWorkingBase);
  }

  for (const base of candidates) {
    try {
      const controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller
        ? setTimeout(() => controller.abort(), 2500)
        : null;

      const res = await globalThis.fetch(`${base}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller?.signal,
      });

      if (timer) clearTimeout(timer);

      if (res.ok) {
        cachedWorkingBase = base;
        return { online: True_bool(), baseUrl: base };
      }
    } catch {}
  }

  return {
    online: false,
    baseUrl: cachedWorkingBase ?? candidates[0] ?? "http://localhost:5001",
  };
}

function True_bool(): boolean {
  return true;
}
