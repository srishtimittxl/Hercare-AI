import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type FlowLevel = "Light" | "Medium" | "Heavy";
export type MoodType =
  | "Happy"
  | "Calm"
  | "Motivated"
  | "Sad"
  | "Irritated"
  | "Anxious"
  | "Tired"
  | "Stressed";
export type SymptomType =
  | "Cramps"
  | "Bloating"
  | "Headache"
  | "Acne"
  | "Fatigue"
  | "Back Pain"
  | "Breast Tenderness";
export type Severity = "Mild" | "Moderate" | "Severe";

export interface CycleLog {
  id: string;
  startDate: string;
  endDate: string | null;
  flowLevel: FlowLevel;
}

export interface MoodLog {
  id: string;
  mood: MoodType;
  notes: string;
  date: string;
}

export interface SymptomLog {
  id: string;
  symptom: SymptomType;
  severity: Severity;
  date: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface UserProfile {
  name: string;
  email: string;
  averageCycleLength: number;
}

interface AppContextType {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;

  cycleLogs: CycleLog[];
  addCycleLog: (log: Omit<CycleLog, "id">) => void;
  updateCycleLog: (id: string, updates: Partial<CycleLog>) => void;

  moodLogs: MoodLog[];
  addMoodLog: (log: Omit<MoodLog, "id">) => void;

  symptomLogs: SymptomLog[];
  addSymptomLog: (log: Omit<SymptomLog, "id">) => void;

  chatHistory: ChatMessage[];
  addChatMessage: (msg: Omit<ChatMessage, "id">) => void;
  clearChatHistory: () => void;

  currentCycleDay: number | null;
  daysUntilNextPeriod: number | null;
  currentPhase: string;
  predictedNextPeriod: string | null;
  averageCycleLength: number;
}

const defaultProfile: UserProfile = {
  name: "User",
  email: "",
  averageCycleLength: 28,
};

const AppContext = createContext<AppContextType | null>(null);

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function calcCycleStats(logs: CycleLog[]): {
  currentDay: number | null;
  daysUntilNext: number | null;
  phase: string;
  predicted: string | null;
  avgLength: number;
} {
  if (logs.length === 0) {
    return {
      currentDay: null,
      daysUntilNext: null,
      phase: "Unknown",
      predicted: null,
      avgLength: 28,
    };
  }

  const sorted = [...logs].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
  const latest = sorted[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(latest.startDate);
  startDate.setHours(0, 0, 0, 0);

  let avgLength = 28;
  if (sorted.length >= 2) {
    let total = 0;
    let count = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const diff =
        (new Date(sorted[i].startDate).getTime() -
          new Date(sorted[i + 1].startDate).getTime()) /
        (1000 * 60 * 60 * 24);
      if (diff > 15 && diff < 45) {
        total += diff;
        count++;
      }
    }
    if (count > 0) avgLength = Math.round(total / count);
  }

  const dayOfCycle = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  const predictedDate = new Date(startDate);
  predictedDate.setDate(predictedDate.getDate() + avgLength);
  const daysUntil = Math.floor(
    (predictedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  let phase = "Follicular";
  const dayMod = ((dayOfCycle - 1) % avgLength) + 1;
  if (dayMod <= 5) phase = "Menstrual";
  else if (dayMod <= 13) phase = "Follicular";
  else if (dayMod <= 15) phase = "Ovulation";
  else phase = "Luteal";

  const predicted = predictedDate.toISOString().split("T")[0];

  return {
    currentDay: dayOfCycle,
    daysUntilNext: daysUntil,
    phase,
    predicted,
    avgLength,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [cycleLogs, setCycleLogs] = useState<CycleLog[]>([]);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [p, c, m, s, ch] = await Promise.all([
          AsyncStorage.getItem("hercare_profile"),
          AsyncStorage.getItem("hercare_cycles"),
          AsyncStorage.getItem("hercare_moods"),
          AsyncStorage.getItem("hercare_symptoms"),
          AsyncStorage.getItem("hercare_chat"),
        ]);
        if (p) setProfileState(JSON.parse(p));
        if (c) setCycleLogs(JSON.parse(c));
        if (m) setMoodLogs(JSON.parse(m));
        if (s) setSymptomLogs(JSON.parse(s));
        if (ch) setChatHistory(JSON.parse(ch));
      } catch {}
    })();
  }, []);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    AsyncStorage.setItem("hercare_profile", JSON.stringify(p));
  }, []);

  const addCycleLog = useCallback((log: Omit<CycleLog, "id">) => {
    const newLog = { ...log, id: generateId() };
    setCycleLogs((prev) => {
      const next = [newLog, ...prev];
      AsyncStorage.setItem("hercare_cycles", JSON.stringify(next));
      return next;
    });
  }, []);

  const updateCycleLog = useCallback(
    (id: string, updates: Partial<CycleLog>) => {
      setCycleLogs((prev) => {
        const next = prev.map((l) => (l.id === id ? { ...l, ...updates } : l));
        AsyncStorage.setItem("hercare_cycles", JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const addMoodLog = useCallback((log: Omit<MoodLog, "id">) => {
    const newLog = { ...log, id: generateId() };
    setMoodLogs((prev) => {
      const next = [newLog, ...prev];
      AsyncStorage.setItem("hercare_moods", JSON.stringify(next));
      return next;
    });
  }, []);

  const addSymptomLog = useCallback((log: Omit<SymptomLog, "id">) => {
    const newLog = { ...log, id: generateId() };
    setSymptomLogs((prev) => {
      const next = [newLog, ...prev];
      AsyncStorage.setItem("hercare_symptoms", JSON.stringify(next));
      return next;
    });
  }, []);

  const addChatMessage = useCallback((msg: Omit<ChatMessage, "id">) => {
    const newMsg = { ...msg, id: generateId() };
    setChatHistory((prev) => {
      const next = [...prev, newMsg];
      AsyncStorage.setItem("hercare_chat", JSON.stringify(next));
      return next;
    });
  }, []);

  const clearChatHistory = useCallback(() => {
    setChatHistory([]);
    AsyncStorage.removeItem("hercare_chat");
  }, []);

  const stats = calcCycleStats(cycleLogs);

  return (
    <AppContext.Provider
      value={{
        profile,
        setProfile,
        cycleLogs,
        addCycleLog,
        updateCycleLog,
        moodLogs,
        addMoodLog,
        symptomLogs,
        addSymptomLog,
        chatHistory,
        addChatMessage,
        clearChatHistory,
        currentCycleDay: stats.currentDay,
        daysUntilNextPeriod: stats.daysUntilNext,
        currentPhase: stats.phase,
        predictedNextPeriod: stats.predicted,
        averageCycleLength: stats.avgLength,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
