/**
 * 手机端 App - SYNC·心跃
 * 充当舱内体验的"遥控器"
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Sparkles, Wifi, WifiOff, ChevronRight, Check, X, Clock, Brain, Lightbulb, QrCode } from 'lucide-react';
import { createRoom, joinRoom, sendMobileAction, watchCabinState, addInspirationCard, cleanup, CabinSession } from './services/firebase';

// 舱内模式映射
const MODE_INFO = {
  idle: { name: '等待连接', icon: Wifi, color: '#666', tip: '请在舱内大屏扫码' },
  waiting: { name: '等待启动', icon: Clock, color: '#4FACFE', tip: '舱内已就绪，请启动体验' },
  'pose-confirm': { name: '姿态确认中', icon: Check, color: '#00C853', tip: '保持姿势...' },
  recharge: { name: '精神充能', icon: Zap, color: '#4FACFE', tip: '聚焦 · 收束 · 充能' },
  inspiration: { name: '灵感触发', icon: Lightbulb, color: '#FF6B35', tip: '发散 · 发现 · 激活' },
  ending: { name: '体验结束', icon: Brain, color: '#9C27B0', tip: '正在生成报告...' },
  completed: { name: '已完成', icon: Check, color: '#4CAF50', tip: '体验完成，可在下方查看结果' }
};

type MobileScreen = 'home' | 'scan' | 'connecting' | 'controller' | 'result';

export default function MobileApp() {
  const [screen, setScreen] = useState<MobileScreen>('home');
  const [sessionCode, setSessionCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [cabinState, setCabinState] = useState<CabinSession['cabin'] | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [localCards, setLocalCards] = useState<string[]>([]);
  const [showTip, setShowTip] = useState(true);

  // 监听舱内状态变化
  const handleStateChange = useCallback((state: Partial<CabinSession['cabin']>) => {
    setCabinState((prev: any) => ({ ...prev, ...state }));
    
    // 如果有新的灵感卡片
    if (state.cards && state.cards.length > localCards.length) {
      setLocalCards(state.cards);
    }
  }, [localCards]);

  // 离开房间清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // 创建房间（舱内端扫描）
  const handleCreateRoom = async () => {
    setScreen('connecting');
    try {
      const code = await createRoom();
      setSessionCode(code);
      
      // 监听舱内状态
      watchCabinState(handleStateChange);
      
      setScreen('controller');
      setIsConnected(true);
    } catch (err) {
      console.error('创建房间失败:', err);
      setScreen('home');
    }
  };

  // 加入房间（输入连接码）
  const handleJoinRoom = async () => {
    if (inputCode.length !== 6) return;
    
    setScreen('connecting');
    
    // 设置超时，15秒后如果还没连上就提示
    const timeout = setTimeout(() => {
      console.error('连接超时');
      cleanup();
      setScreen('home');
      alert('连接超时，请确认：\n1. 舱内大屏已生成连接码\n2. 手机网络正常');
    }, 15000);
    
    try {
      await joinRoom(inputCode.toUpperCase(), (data) => {
        clearTimeout(timeout);
        if (data) {
          setCabinState(data.cabin);
          setIsConnected(true);
          setScreen('controller');
          watchCabinState(handleStateChange);
        } else {
          // 房间不存在
          cleanup();
          setScreen('home');
          alert('房间不存在，请确认连接码正确');
        }
      });
    } catch (err) {
      clearTimeout(timeout);
      console.error('加入房间失败:', err);
      setScreen('home');
    }
  };

  // 发送动作到舱内
  const sendAction = async (action: string, extra?: any) => {
    await sendMobileAction(action, extra);
  };

  // 手动添加灵感
  const handleAddIdea = async () => {
    const idea = prompt('记录你的灵感：');
    if (idea?.trim()) {
      setLocalCards(prev => [...prev, idea.trim()]);
      await addInspirationCard(idea.trim());
    }
  };

  const currentMode = cabinState?.mode || 'idle';
  const modeInfo = MODE_INFO[currentMode as keyof typeof MODE_INFO] || MODE_INFO.idle;
  const ModeIcon = modeInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white p-4">
      {/* 状态栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-500'}`} />
          <span className="text-xs text-gray-400">
            {isConnected ? '已连接' : '未连接'}
          </span>
        </div>
        {sessionCode && (
          <span className="text-xs text-gray-400 font-mono">
            房间号: {sessionCode}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* 首页 */}
        {screen === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Logo */}
            <div className="text-center py-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                SYNC · 心跃
              </h1>
              <p className="text-gray-400 mt-2 text-sm">舱内体验遥控器</p>
            </div>

            {/* 选择入口 */}
            <div className="space-y-3">
              <button
                onClick={handleCreateRoom}
                className="w-full p-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <QrCode className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">扫描舱内二维码</div>
                  <div className="text-xs opacity-80">舱内大屏显示连接码，扫码连接</div>
                </div>
                <ChevronRight className="ml-auto" />
              </button>

              <div className="flex items-center gap-3 text-gray-500">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-xs">或</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="输入6位连接码"
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-center text-2xl font-mono tracking-widest"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={inputCode.length !== 6}
                  className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl disabled:opacity-50"
                >
                  加入体验
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 连接中 */}
        {screen === 'connecting' && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center min-h-[60vh]"
          >
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-gray-400">正在连接...</p>
          </motion.div>
        )}

        {/* 控制台 */}
        {(screen === 'controller') && (
          <motion.div
            key="controller"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* 当前模式卡片 */}
            <div
              className="p-6 rounded-3xl text-white"
              style={{ background: `linear-gradient(135deg, ${modeInfo.color}33, ${modeInfo.color}11)` }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: `${modeInfo.color}33` }}
                >
                  <ModeIcon className="w-8 h-8" style={{ color: modeInfo.color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{modeInfo.name}</div>
                  <div className="text-sm opacity-70">{modeInfo.tip}</div>
                </div>
              </div>
            </div>

            {/* 动作按钮 - 根据舱内状态显示不同操作 */}
            {currentMode === 'idle' && (
              <div className="space-y-3">
                <p className="text-center text-gray-400 text-sm">
                  请在舱内大屏打开页面，获取连接码
                </p>
                <button
                  onClick={() => setInputCode('')}
                  className="w-full p-4 bg-white/10 rounded-2xl"
                >
                  输入连接码
                </button>
              </div>
            )}

            {currentMode === 'waiting' && (
              <div className="space-y-3">
                <p className="text-center text-gray-400 text-sm mb-4">
                  舱内已就绪，请选择体验模式
                </p>
                
                {/* 精神充能 */}
                <button
                  onClick={() => sendAction('start_recharge')}
                  className="w-full p-5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-lg">精神充能</div>
                    <div className="text-xs opacity-80">聚焦 · 收束 · 稳定</div>
                  </div>
                </button>

                {/* 灵感触发 */}
                <button
                  onClick={() => sendAction('start_inspiration')}
                  className="w-full p-5 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-lg">灵感触发</div>
                    <div className="text-xs opacity-80">发散 · 发现 · 激活</div>
                  </div>
                </button>
              </div>
            )}

            {(currentMode === 'recharge' || currentMode === 'inspiration') && (
              <div className="space-y-3">
                {/* 体验进行中 */}
                <div className="p-4 bg-white/5 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-400">体验进度</span>
                    <span className="text-sm">{Math.round((cabinState?.timeElapsed || 0) / 6)}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((cabinState?.timeElapsed || 0) / 6, 100)}%` }}
                    />
                  </div>
                </div>

                {/* 添加灵感 */}
                <button
                  onClick={handleAddIdea}
                  className="w-full p-4 bg-white/10 rounded-2xl flex items-center justify-center gap-2"
                >
                  <Lightbulb className="w-5 h-5" />
                  记录灵感
                </button>
              </div>
            )}

            {currentMode === 'completed' && (
              <div className="space-y-3">
                <p className="text-center text-gray-400">体验已完成！</p>
                
                {/* 灵感卡片 */}
                <div className="space-y-2">
                  <h3 className="text-sm text-gray-400">灵感记录</h3>
                  {localCards.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">暂无灵感记录</p>
                  ) : (
                    localCards.map((card, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-white/5 rounded-xl text-sm"
                      >
                        {card}
                      </motion.div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => {
                    cleanup();
                    setScreen('home');
                    setIsConnected(false);
                    setCabinState(null);
                    setLocalCards([]);
                    setSessionCode('');
                  }}
                  className="w-full p-4 bg-white/10 rounded-2xl"
                >
                  结束体验
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
