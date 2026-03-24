/**
 * Firebase 实时同步服务
 * 舱内端和手机端通过 Firebase 实时数据库同步状态
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, onDisconnect, DatabaseReference } from 'firebase/database';

// Firebase 配置 - 从环境变量读取
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// 检查配置是否完整
const isConfigured = () => {
  return firebaseConfig.apiKey && 
         firebaseConfig.databaseURL && 
         firebaseConfig.projectId;
};

// 初始化 Firebase（延迟初始化）
let app: ReturnType<typeof initializeApp> | null = null;
let database: ReturnType<typeof getDatabase> | null = null;

const initFirebase = () => {
  if (!isConfigured()) {
    console.warn('⚠️ Firebase 未配置！请在 .env 文件中设置以下环境变量：');
    console.warn('VITE_FIREBASE_API_KEY');
    console.warn('VITE_FIREBASE_AUTH_DOMAIN');
    console.warn('VITE_FIREBASE_DATABASE_URL');
    console.warn('VITE_FIREBASE_PROJECT_ID');
    console.warn('VITE_FIREBASE_STORAGE_BUCKET');
    console.warn('VITE_FIREBASE_MESSAGING_SENDER_ID');
    console.warn('VITE_FIREBASE_APP_ID');
    return false;
  }
  
  if (!app) {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
  }
  return true;
};

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

// 房间引用
let currentSessionCode: string | null = null;
let unsubscribers: (() => void)[] = [];

/**
 * 创建新房间（舱内端调用）
 */
export const createRoom = async (): Promise<string> => {
  if (!initFirebase()) {
    throw new Error('Firebase 未配置');
  }
  
  const code = generateSessionCode();
  const sessionRef = ref(database!, `sessions/${code}`);
  
  const initialData: CabinSession = {
    cabin: {
      mode: 'idle',
      targetMode: null,
      timeElapsed: 0,
      cards: [],
      sessionId: null
    },
    mobile: {
      connected: false,
      lastSeen: Date.now(),
      lastAction: null
    },
    meta: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionCode: code
    }
  };

  await set(sessionRef, initialData);
  
  // 断线自动清理（24小时后）
  const metaRef = ref(database!, `sessions/${code}/meta`);
  onDisconnect(metaRef).remove();

  currentSessionCode = code;
  return code;
};

/**
 * 加入房间（手机端调用）
 */
export const joinRoom = (code: string, onUpdate: (data: CabinSession | null) => void): (() => void) => {
  if (!initFirebase()) {
    console.error('Firebase 未配置');
    return () => {};
  }
  
  const sessionRef = ref(database!, `sessions/${code}`);
  
  const unsubscribe = onValue(sessionRef, (snapshot) => {
    const data = snapshot.val() as CabinSession | null;
    onUpdate(data);
  });

  unsubscribers.push(unsubscribe);
  currentSessionCode = code;
  return unsubscribe;
};

/**
 * 更新舱内状态（舱内端调用）
 */
export const updateCabinMode = async (
  mode: CabinSession['cabin']['mode'],
  extra?: Partial<CabinSession['cabin']>
) => {
  if (!currentSessionCode || !database) return;
  
  const updates: Partial<CabinSession['cabin']> = { mode, ...extra };
  await set(ref(database, `sessions/${currentSessionCode}/cabin`), updates);
  await set(ref(database, `sessions/${currentSessionCode}/meta/updatedAt`), Date.now());
};

/**
 * 手机端发送指令（手机端调用）
 */
export const sendMobileAction = async (action: string | null) => {
  if (!currentSessionCode || !database) return;

  await set(ref(database, `sessions/${currentSessionCode}/mobile/lastAction`), action);
  await set(ref(database, `sessions/${currentSessionCode}/mobile/lastSeen`), Date.now());
  await set(ref(database, `sessions/${currentSessionCode}/mobile/connected`), !!action);
  await set(ref(database, `sessions/${currentSessionCode}/meta/updatedAt`), Date.now());
};

/**
 * 更新舱内端手机连接状态
 */
export const setMobileConnected = async (connected: boolean) => {
  if (!currentSessionCode || !database) return;
  await set(ref(database, `sessions/${currentSessionCode}/mobile/connected`), connected);
};

/**
 * 添加灵感卡片
 */
export const addInspirationCard = async (card: string) => {
  if (!currentSessionCode || !database) return;
  
  const cardsRef = ref(database, `sessions/${currentSessionCode}/cabin/cards`);
  // 简单方案：直接覆盖
  await set(cardsRef, card);
};

/**
 * 监听手机端操作（舱内端调用）
 */
export const watchMobileActions = (
  onAction: (action: string) => void
): (() => void) => {
  if (!currentSessionCode || !database) return () => {};

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

/**
 * 监听舱内状态变化（手机端调用）
 */
export const watchCabinState = (
  onStateChange: (state: Partial<CabinSession['cabin']>) => void
): (() => void) => {
  if (!currentSessionCode || !database) return () => {};

  const cabinRef = ref(database, `sessions/${currentSessionCode}/cabin`);
  
  const unsubscribe = onValue(cabinRef, (snapshot) => {
    const state = snapshot.val() as CabinSession['cabin'] | null;
    if (state) {
      onStateChange(state);
    }
  });

  unsubscribers.push(unsubscribe);
  return unsubscribe;
};

/**
 * 离开房间
 */
export const leaveRoom = async () => {
  if (currentSessionCode && database) {
    await set(ref(database, `sessions/${currentSessionCode}/mobile/connected`), false);
  }
  cleanup();
};

/**
 * 清理监听器
 */
export const cleanup = () => {
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];
  currentSessionCode = null;
};

// 导出 database 供外部使用
export { database };
