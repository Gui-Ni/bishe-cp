/**
 * Firebase 实时同步服务
 * 舱内端和手机端通过 Firebase 实时数据库同步状态
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, onDisconnect } from 'firebase/database';

// Firebase 配置（GitHub Actions 注入）
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC_WIUxzdXuqAzdrjM4kJAUSK59txPWonc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gray-d5f9f.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://gray-d5f9f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gray-d5f9f",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gray-d5f9f.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "679523583493",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:679523583493:web:8f3c6e614aa8e17e6e3e6c"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// 会话房间类型
export interface CabinSession {
  cabin: {
    mode: 'idle' | 'waiting' | 'pose-confirm' | 'recharge' | 'inspiration' | 'ending' | 'completed';
    targetMode: 'recharge' | 'inspiration' | null;
    timeElapsed: number;
    cards: string[];
    sessionId: string | null;
  };
  mobile: {
    connected: boolean;
    lastSeen: number;
    lastAction: string | null;
  };
  meta: {
    createdAt: number;
    updatedAt: number;
    sessionCode: string;
  };
}

// 生成6位连接码
const generateSessionCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

let currentSessionCode: string | null = null;
let unsubscribers: (() => void)[] = [];

// 创建新房间（舱内端调用）
export const createRoom = async (): Promise<string> => {
  const code = generateSessionCode();
  const sessionRef = ref(database, `sessions/${code}`);
  
  const initialData: CabinSession = {
    cabin: { mode: 'idle', targetMode: null, timeElapsed: 0, cards: [], sessionId: null },
    mobile: { connected: false, lastSeen: Date.now(), lastAction: null },
    meta: { createdAt: Date.now(), updatedAt: Date.now(), sessionCode: code }
  };

  await set(sessionRef, initialData);
  onDisconnect(ref(database, `sessions/${code}/meta`)).remove();
  currentSessionCode = code;
  return code;
};

// 加入房间（手机端调用）
export const joinRoom = (code: string, onUpdate: (data: CabinSession | null) => void): (() => void) => {
  const sessionRef = ref(database, `sessions/${code}`);
  const unsubscribe = onValue(sessionRef, (snapshot) => {
    onUpdate(snapshot.val() as CabinSession | null);
  });
  unsubscribers.push(unsubscribe);
  currentSessionCode = code;
  return unsubscribe;
};

// 更新舱内状态
export const updateCabinMode = async (mode: CabinSession['cabin']['mode'], extra?: Partial<CabinSession['cabin']>) => {
  if (!currentSessionCode) return;
  await set(ref(database, `sessions/${currentSessionCode}/cabin`), { mode, ...extra });
  await set(ref(database, `sessions/${currentSessionCode}/meta/updatedAt`), Date.now());
};

// 手机端发送指令
export const sendMobileAction = async (action: string | null) => {
  if (!currentSessionCode) return;
  await set(ref(database, `sessions/${currentSessionCode}/mobile/lastAction`), action);
  await set(ref(database, `sessions/${currentSessionCode}/mobile/lastSeen`), Date.now());
  await set(ref(database, `sessions/${currentSessionCode}/mobile/connected`), !!action);
  await set(ref(database, `sessions/${currentSessionCode}/meta/updatedAt`), Date.now());
};

// 添加灵感卡片
export const addInspirationCard = async (card: string) => {
  if (!currentSessionCode) return;
  await set(ref(database, `sessions/${currentSessionCode}/cabin/cards`), card);
};

// 监听手机端操作（舱内端）
export const watchMobileActions = (onAction: (action: string) => void): (() => void) => {
  if (!currentSessionCode) return () => {};
  const actionRef = ref(database, `sessions/${currentSessionCode}/mobile/lastAction`);
  let lastAction = '';
  const unsubscribe = onValue(actionRef, (snapshot) => {
    const action = snapshot.val() as string | null;
    if (action && action !== lastAction) {
      lastAction = action;
      onAction(action);
    }
  });
  unsubscribers.push(unsubscribe);
  return unsubscribe;
};

// 监听舱内状态（手机端）
export const watchCabinState = (onStateChange: (state: Partial<CabinSession['cabin']>) => void): (() => void) => {
  if (!currentSessionCode) return () => {};
  const cabinRef = ref(database, `sessions/${currentSessionCode}/cabin`);
  const unsubscribe = onValue(cabinRef, (snapshot) => {
    const state = snapshot.val() as CabinSession['cabin'] | null;
    if (state) onStateChange(state);
  });
  unsubscribers.push(unsubscribe);
  return unsubscribe;
};

// 离开房间
export const leaveRoom = async () => {
  if (currentSessionCode) {
    await set(ref(database, `sessions/${currentSessionCode}/mobile/connected`), false);
  }
  cleanup();
};

// 清理
export const cleanup = () => {
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];
  currentSessionCode = null;
};

export { database };
