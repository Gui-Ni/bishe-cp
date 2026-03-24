/**
 * 舱内大屏 App - SYNC·心跃
 * 沉浸式体验界面，支持 Firebase 实时同步
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Sparkles, Wifi, WifiOff, Monitor, Power, Mic, Check, Hand, Loader2, QrCode, Heart
} from 'lucide-react';
import {
  createRoom,
  updateCabinMode,
  watchMobileActions,
  addInspirationCard,
  cleanup,
  sendMobileAction
} from './services/firebase';

type CabinMode = 'idle' | 'waiting' | 'pose-confirm' | 'recharge' | 'inspiration' | 'ending' | 'completed';

interface EnergyBall { id: number; isConsumed: boolean; x: number; y: number; size: number; }
interface Ripple { id: number; x: number; y: number; }

// 白噪音 hook
const useBackgroundNoise = (isPlaying: boolean) => {
  useEffect(() => {
    if (!isPlaying) return;
    let audioCtx: AudioContext; let gainNode: GainNode; let noiseSource: AudioBufferSourceNode;
    try {
      // @ts-ignore
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const bufferSize = audioCtx.sampleRate * 2;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i]; data[i] *= 3.5;
      }
      noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 3);
      noiseSource.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      noiseSource.start();
    } catch (e) { console.error("Audio failed", e); }
    return () => {
      if (gainNode && audioCtx) {
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);
        setTimeout(() => { if (noiseSource) noiseSource.stop(); if (audioCtx.state !== 'closed') audioCtx.close(); }, 1500);
      }
    };
  }, [isPlaying]);
};

// SYNC Logo 组件
const SyncLogo = ({ size = 160, isBreathing = true }: { size?: number; isBreathing?: boolean }) => {
  const dots = [
    { size: 4, y: -45, x: 0 }, { size: 6, y: -25, x: 10 }, { size: 8, y: -5, x: 15 },
    { size: 10, y: 15, x: 15 }, { size: 8, y: 35, x: 10 }, { size: 6, y: 55, x: 0 }, { size: 4, y: 75, x: -10 }
  ];
  return (
    <div className="relative flex items-center justify-center" style={{ width: size * 1.5, height: size }}>
      <motion.div
        animate={isBreathing ? { scale: [1, 0.95, 1], opacity: [0.9, 0.7, 0.9] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full"
        style={{
          width: size, height: size,
          background: 'linear-gradient(135deg, #4FACFE 0%, rgba(255,255,255,0.9) 100%)',
          boxShadow: '0 0 60px rgba(79, 172, 254, 0.4)'
        }}
      />
      <motion.div
        animate={isBreathing ? { scale: [1, 0.9, 1], opacity: [0.8, 0.6, 0.8] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full"
        style={{
          width: size * 0.75, height: size * 0.75,
          background: 'linear-gradient(135deg, #4FACFE 0%, rgba(255,255,255,0.9) 100%)',
          opacity: 0.6
        }}
      />
      <div className="relative h-full ml-4 flex items-center">
        {dots.map((dot, i) => (
          <motion.div
            key={i}
            className="absolute bg-[#4FACFE] rounded-full"
            animate={isBreathing ? { opacity: [0.4, 0.9, 0.4] } : {}}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
            style={{ width: dot.size, height: dot.size, top: `calc(50% + ${dot.y}px - ${dot.size / 2}px)`, left: `${dot.x}px` }}
          />
        ))}
      </div>
    </div>
  );
};

export default function CabinApp() {
  const [cabinMode, setCabinMode] = useState<CabinMode>('idle');
  const [targetMode, setTargetMode] = useState<'recharge' | 'inspiration' | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [mobileConnected, setMobileConnected] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [confirmProgress, setConfirmProgress] = useState(0);
  const [pushProgress, setPushProgress] = useState(0);
  const [balls, setBalls] = useState<EnergyBall[]>([]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [cards, setCards] = useState<string[]>([]);
  const [showCode, setShowCode] = useState(true);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeRef = useRef<NodeJS.Timeout | null>(null);
  
  useBackgroundNoise(cabinMode === 'recharge' || cabinMode === 'inspiration');

  // 创建房间
  const handleCreateRoom = async () => {
    try {
      const code = await createRoom();
      setSessionCode(code);
      setCabinMode('waiting');
      
      // 监听手机端动作
      watchMobileActions((action) => {
        console.log('收到手机动作:', action);
        
        if (action === 'start_recharge') {
          setTargetMode('recharge');
          setCabinMode('pose-confirm');
        } else if (action === 'start_inspiration') {
          setTargetMode('inspiration');
          setCabinMode('pose-confirm');
        } else if (action === 'add_card') {
          // 处理添加卡片
        }
        
        // 清除动作
        sendMobileAction(null);
      });
      
      // 隐藏二维码，显示等待
      setTimeout(() => setShowCode(false), 3000);
    } catch (err) {
      console.error('创建房间失败:', err);
    }
  };

  // 姿态确认完成
  const handlePoseComplete = () => {
    if (targetMode) {
      setCabinMode(targetMode);
      setMobileConnected(true);
      
      // 开始计时
      if (timeRef.current) clearInterval(timeRef.current);
      timeRef.current = setInterval(() => {
        setTimeElapsed(t => {
          if (t >= (targetMode === 'recharge' ? 600 : 720) - 1) {
            handleSessionEnd();
            return t;
          }
          return t + 1;
        });
      }, 1000);
      
      // 初始化能量球
      if (targetMode === 'recharge') {
        initEnergyBalls();
      }
    }
  };

  // 初始化能量球（精神充能模式）
  const initEnergyBalls = () => {
    const newBalls: EnergyBall[] = [];
    for (let i = 0; i < 8; i++) {
      newBalls.push({
        id: Date.now() + i,
        isConsumed: false,
        x: Math.random() * window.innerWidth * 0.8,
        y: Math.random() * window.innerHeight * 0.5 + 100,
        size: 40 + Math.random() * 40
      });
    }
    setBalls(newBalls);
  };

  // 消耗能量球
  const consumeBall = (id: number) => {
    setBalls(prev => prev.map(b => b.id === id ? { ...b, isConsumed: true } : b));
    setPushProgress(100);
    
    setTimeout(() => {
      setBalls(prev => prev.filter(b => b.id !== id));
      if (balls.length <= 1) {
        handleSessionEnd();
      }
    }, 500);
  };

  // 结束体验
  const handleSessionEnd = () => {
    if (timeRef.current) clearInterval(timeRef.current);
    setCabinMode('ending');
    updateCabinMode('ending');
    
    setTimeout(() => {
      setCabinMode('completed');
      updateCabinMode('completed');
    }, 2000);
  };

  // 姿态确认进度
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cabinMode === 'pose-confirm') {
      if (isPressing) {
        interval = setInterval(() => {
          setConfirmProgress(p => {
            if (p >= 100) {
              handlePoseComplete();
              return 100;
            }
            return p + 2;
          });
        }, 30);
      } else {
        interval = setInterval(() => setConfirmProgress(p => Math.max(p - 4, 0)), 30);
      }
    } else {
      setConfirmProgress(0);
    }
    return () => clearInterval(interval);
  }, [isPressing, cabinMode]);

  // 推进进度衰减
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pushProgress > 0) {
      interval = setInterval(() => setPushProgress(p => Math.max(p - 2, 0)), 40);
    }
    return () => clearInterval(interval);
  }, [pushProgress]);

  // 灵感模式：随机生成涟漪
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cabinMode === 'inspiration') {
      interval = setInterval(() => {
        setRipples(prev => {
          if (prev.length > 10) return prev.slice(1);
          return [...prev, {
            id: Date.now(),
            x: Math.random() * window.innerWidth * 0.8,
            y: Math.random() * window.innerHeight * 0.5 + 100
          }];
        });
      }, 800);
    }
    return () => clearInterval(interval);
  }, [cabinMode]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentTime = cabinMode === 'recharge' ? 600 : 720;
  const progress = Math.min(timeElapsed / currentTime * 100, 100);

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] text-white overflow-hidden">
      {/* 背景光效 */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(79, 172, 254, 0.3) 0%, transparent 70%)',
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
          animate={cabinMode !== 'idle' ? {
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2]
          } : {}}
          transition={{ duration: 4, repeat: Infinity }}
        />
      </div>

      <AnimatePresence mode="wait">
        {/* ===== 空闲状态：显示二维码 ===== */}
        {cabinMode === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20"
          >
            <SyncLogo size={200} isBreathing={true} />
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-4xl font-bold mt-8 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"
            >
              SYNC · 心跃
            </motion.h1>
            <p className="text-gray-400 mt-4 text-lg">舱内体验系统</p>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              onClick={handleCreateRoom}
              className="mt-12 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full text-lg font-semibold flex items-center gap-3"
            >
              <QrCode className="w-6 h-6" />
              生成连接码
            </motion.button>
          </motion.div>
        )}

        {/* ===== 等待状态：显示连接码 ===== */}
        {cabinMode === 'waiting' && sessionCode && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-64 h-64 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-3xl flex items-center justify-center border border-blue-500/30"
            >
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-2">手机扫码连接</p>
                <p className="text-5xl font-mono font-bold tracking-widest text-blue-400">{sessionCode}</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8 flex items-center gap-3"
            >
              <div className={`w-3 h-3 rounded-full ${mobileConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
              <span className="text-gray-400">
                {mobileConnected ? '手机已连接' : '等待手机连接...'}
              </span>
            </motion.div>

            <p className="mt-12 text-gray-500 text-sm">请使用手机扫描舱内屏幕上的二维码</p>
          </motion.div>
        )}

        {/* ===== 姿态确认 ===== */}
        {cabinMode === 'pose-confirm' && (
          <motion.div
            key="pose-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20"
          >
            <SyncLogo size={120} isBreathing={true} />

            <h2 className="text-3xl font-bold mt-8">
              {targetMode === 'recharge' ? '精神充能' : '灵感触发'}
            </h2>
            <p className="text-gray-400 mt-4">双手按住两侧感应区，保持3秒</p>

            {/* 进度环 */}
            <div className="relative w-48 h-48 mt-8">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96" cy="96" r="88"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                />
                <circle
                  cx="96" cy="96" r="88"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 88}
                  strokeDashoffset={2 * Math.PI * 88 * (1 - confirmProgress / 100)}
                  className="transition-all duration-75"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4FACFE" />
                    <stop offset="100%" stopColor="#00C853" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Hand className="w-12 h-12 text-blue-400 mb-2" />
                <span className="text-3xl font-bold">{Math.round(confirmProgress)}%</span>
              </div>
            </div>

            <button
              onTouchStart={() => setIsPressing(true)}
              onTouchEnd={() => setIsPressing(false)}
              onMouseDown={() => setIsPressing(true)}
              onMouseUp={() => setIsPressing(false)}
              onMouseLeave={() => setIsPressing(false)}
              className="absolute inset-0 z-30"
            />
          </motion.div>
        )}

        {/* ===== 精神充能模式 ===== */}
        {cabinMode === 'recharge' && (
          <motion.div
            key="recharge"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10"
          >
            {/* 能量球 */}
            {balls.map((ball) => (
              !ball.isConsumed && (
                <motion.div
                  key={ball.id}
                  className="absolute cursor-pointer"
                  style={{
                    left: ball.x, top: ball.y,
                    width: ball.size, height: ball.size
                  }}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => consumeBall(ball.id)}
                >
                  <div
                    className="w-full h-full rounded-full"
                    style={{
                      background: 'radial-gradient(circle at 30% 30%, #4FACFE, #00C853)',
                      boxShadow: '0 0 30px rgba(79, 172, 254, 0.5)'
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-cyan-400"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>
              )
            ))}

            {/* 推进波纹 */}
            {pushProgress > 0 && (
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-400 pointer-events-none"
                initial={{ width: 0, height: 0, opacity: 1 }}
                animate={{ width: pushProgress * 10, height: pushProgress * 10, opacity: 0 }}
                style={{ marginLeft: -pushProgress * 5, marginTop: -pushProgress * 5 }}
              />
            )}

            {/* 中心 Logo */}
            <div className="absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2">
              <SyncLogo size={80} isBreathing={true} />
            </div>
          </motion.div>
        )}

        {/* ===== 灵感触发模式 ===== */}
        {cabinMode === 'inspiration' && (
          <motion.div
            key="inspiration"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10"
          >
            {/* 涟漪效果 */}
            {ripples.map((ripple) => (
              <motion.div
                key={ripple.id}
                className="absolute w-8 h-8"
                style={{ left: ripple.x, top: ripple.y }}
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 4, opacity: 0 }}
                transition={{ duration: 1.5 }}
              >
                <div className="w-full h-full rounded-full border-2 border-orange-400" />
              </motion.div>
            ))}

            {/* 灵感文字 */}
            <motion.div
              className="absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Sparkles className="w-16 h-16 mx-auto text-orange-400 mb-4" />
              <p className="text-2xl text-gray-300">点击任意位置</p>
              <p className="text-gray-500 mt-2">触发灵感涟漪</p>
            </motion.div>

            <div
              className="absolute inset-0 z-20 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setRipples(prev => [...prev.slice(-5), {
                  id: Date.now(),
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top
                }]);
              }}
            />
          </motion.div>
        )}

        {/* ===== 结束/完成 ===== */}
        {(cabinMode === 'ending' || cabinMode === 'completed') && (
          <motion.div
            key="ending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20"
          >
            {cabinMode === 'ending' ? (
              <>
                <Loader2 className="w-16 h-16 text-blue-400 animate-spin" />
                <p className="text-xl mt-4 text-gray-400">正在生成体验报告...</p>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 10 }}
                >
                  <Check className="w-24 h-24 text-green-400" />
                </motion.div>
                <h2 className="text-4xl font-bold mt-6">体验完成</h2>
                <p className="text-gray-400 mt-4">
                  时长 {formatTime(timeElapsed)} · 记录 {cards.length} 条灵感
                </p>
                <p className="text-gray-500 mt-8 text-sm">请在手机端查看完整报告</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部状态栏 */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-black/30 backdrop-blur flex items-center justify-between px-8 z-30">
        <div className="flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full ${mobileConnected ? 'bg-green-400' : 'bg-gray-500'}`} />
          <span className="text-sm text-gray-400">
            {mobileConnected ? '手机已连接' : '等待连接'}
          </span>
        </div>

        {(cabinMode === 'recharge' || cabinMode === 'inspiration') && (
          <div className="flex items-center gap-6">
            <span className="text-sm text-gray-400">{formatTime(timeElapsed)}</span>
            <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                animate={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-gray-400">{Math.round(progress)}%</span>
          </div>
        )}

        {sessionCode && (
          <div className="text-sm text-gray-500 font-mono">
            房间号: {sessionCode}
          </div>
        )}
      </div>
    </div>
  );
}
