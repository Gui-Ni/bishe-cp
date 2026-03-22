import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Sparkles, Smartphone, Monitor, ChevronRight, Power, Mic, Check, Hand, Loader2
} from 'lucide-react';

type CabinMode = 'idle' | 'pose-confirm' | 'recharge' | 'inspiration' | 'ending';
type MobileState = 'home' | 'modeSelect' | 'activeInCabin' | 'result' | 'cardsView';

interface Ripple { id: number; x: number; y: number; }
interface EnergyBall { id: number; isConsumed: boolean; x: number; y: number; size: number; }
interface SessionResult { mode: string; percent: number; score: string; cards: number; }

// ==========================================
// 从环境变量读取 Minimax API Key
// ==========================================
const MINIMAX_API_KEY = import.meta.env.VITE_MINIMAX_API_KEY || ""; 

const INSPIRATION_DB =[
  "在静谧的深处，光总是会找到它的出口。",
  "每一次呼吸，都是与宇宙频率的重新校准。",
  "向内收束不是封闭，而是为了更有力量的绽放。",
  "打破原有的边界，让神经元以意想不到的方式连接。"
];

// 获取安全的屏幕生成范围 (适配所有尺寸手机/iPad/PC)
const getSafeBounds = () => {
  const w = typeof window !== 'undefined' ? window.innerWidth : 800;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    xRange: w * 0.75, // 限制在屏幕宽度的 75% 以内
    yRange: h * 0.4   // 限制在屏幕高度的 40% 以内
  };
};

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
      noiseSource = audioCtx.createBufferSource(); noiseSource.buffer = buffer; noiseSource.loop = true;
      const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600; 
      gainNode = audioCtx.createGain(); gainNode.gain.setValueAtTime(0, audioCtx.currentTime); gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 3); 
      noiseSource.connect(filter); filter.connect(gainNode); gainNode.connect(audioCtx.destination); noiseSource.start();
    } catch (e) { console.error("Audio Context failed", e); }

    return () => {
      if (gainNode && audioCtx) {
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5); 
        setTimeout(() => { if (noiseSource) noiseSource.stop(); if (audioCtx.state !== 'closed') audioCtx.close(); }, 1500);
      }
    };
  }, [isPlaying]);
};

const SyncLogo = ({ size = 'large', className = '', isSyncing = false }: { size?: 'large' | 'small', className?: string, isSyncing?: boolean }) => {
  const baseSize = size === 'large' ? 160 : 80;
  const midSize = size === 'large' ? 120 : 60;
  const dots =[ { size: 4, y: -45, x: 0 }, { size: 6, y: -25, x: 10 }, { size: 8, y: -5, x: 15 }, { size: 10, y: 15, x: 15 }, { size: 8, y: 35, x: 10 }, { size: 6, y: 55, x: 0 }, { size: 4, y: 75, x: -10 } ];

  return (
    <div className={`sync-totem flex items-center justify-center w-full ${!isSyncing ? 'breathing' : ''} ${className}`}>
      <div className="flex items-center justify-center relative" style={{ transform: 'translateX(-4%)' }}>
        <motion.div animate={isSyncing ? { scale:[1, 0.95, 1], opacity:[0.9, 0.7, 0.9] } : {}} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="sync-circle relative z-20" style={{ width: `${baseSize}px`, height: `${baseSize}px`, background: 'linear-gradient(to left, #4FACFE 0%, rgba(255, 255, 255, 0.9) 100%)' }} />
        <motion.div animate={isSyncing ? { scale:[1, 0.9, 1], opacity:[0.8, 0.6, 0.8] } : {}} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="sync-circle relative z-10" style={{ width: `${midSize}px`, height: `${midSize}px`, marginLeft: size === 'large' ? '-2px' : '-1px', background: 'linear-gradient(to right, #4FACFE 0%, rgba(255, 255, 255, 0.9) 100%)' }} />
        {size === 'large' && (
          <div className="relative h-full ml-4 flex items-center">
            {dots.map((dot, i) => (
              <motion.div key={i} className="absolute bg-[#4FACFE] rounded-full opacity-90" initial={{ opacity: 0.4 }} animate={{ opacity:[0.4, 0.9, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }} style={{ width: `${dot.size}px`, height: `${dot.size}px`, top: `calc(50% + ${dot.y}px - ${dot.size/2}px)`, left: `${dot.x}px` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 2. 交互舱 UI 
// ==========================================
const CabinUI = ({ 
  cabinMode, setCabinMode, targetMode, addCard, timeElapsed, endSession, recordAction
}: { 
  cabinMode: CabinMode, setCabinMode: (m: CabinMode) => void, targetMode: CabinMode | null, addCard: (t: string) => void, timeElapsed: number, endSession: () => void, recordAction: () => void 
}) => {
  const[isPressing, setIsPressing] = useState(false);
  const[confirmProgress, setConfirmProgress] = useState(0);
  const[pushProgress, setPushProgress] = useState(0);
  const[balls, setBalls] = useState<EnergyBall[]>([]);
  const[randomSpots, setRandomSpots] = useState<{id: number, x: number, y: number, size: number}[]>([]);
  const[ripples, setRipples] = useState<Ripple[]>([]);
  const rippleIdRef = useRef(0);

  const[isListening, setIsListening] = useState(false);
  const[isAIGenerating, setIsAIGenerating] = useState(false);
  const[recordFeedback, setRecordFeedback] = useState("");      
  
  const textBufferRef = useRef(""); 
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  let recognitionRef = useRef<any>(null);

  useBackgroundNoise(cabinMode === 'recharge' || cabinMode === 'inspiration');

  // 初始化语音引擎
  useEffect(() => {
    if (cabinMode === 'idle' || cabinMode === 'pose-confirm' || cabinMode === 'ending') return;
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setRecordFeedback("当前环境无法录音,可长按模拟"); return; }
    
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true; recognitionRef.current.lang = 'zh-CN';
    
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.trim();
      textBufferRef.current += transcript + "，";
      setRecordFeedback(`正在倾听...`); 
      resetSilenceTimer(); 
    };
    recognitionRef.current.onerror = (e:any) => { console.log(e); setIsListening(false); };
    recognitionRef.current.onend = () => setIsListening(false);

    return () => { if(recognitionRef.current) recognitionRef.current.stop(); setIsListening(false); };
  }, [cabinMode]);

  // 调用 Minimax API
  const callMinimaxAPI = async (rawText: string) => {
    setIsAIGenerating(true); setRecordFeedback("AI 正在凝练灵感...");
    try {
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MINIMAX_API_KEY}` },
        body: JSON.stringify({ model: "abab6.5s-chat", messages:[ { role: "system", content: "你是一个冥想与灵感交互舱的AI助手。用户的语音被转换成了文本，包含口语。请你提取核心意思，用一句极简、充满诗意和哲理的话来总结（25字以内）。直接输出总结。" }, { role: "user", content: rawText } ] })
      });
      if (!response.ok) throw new Error('API Failed');
      const data = await response.json();
      addCard(data.choices[0].message.content);
      setRecordFeedback("灵感卡片已生成");
    } catch (error) {
      addCard(rawText); setRecordFeedback("已保存原话内容"); // 兜底
    } finally { setIsAIGenerating(false); setTimeout(() => setRecordFeedback(""), 3000); }
  };

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (isListening && recognitionRef.current) recognitionRef.current.stop();
      const finalIdea = textBufferRef.current.trim().replace(/，$/, '');
      if (finalIdea.length > 0) callMinimaxAPI(finalIdea);
      else { setRecordFeedback("未接收到内容，已取消"); setTimeout(() => setRecordFeedback(""), 2000); }
    }, 3000);
  };

  // 手动点击触发录音
  const startRecording = () => {
    if (isAIGenerating) return;
    textBufferRef.current = "";
    setRecordFeedback("正在倾听，请说话...");
    try { if(recognitionRef.current) recognitionRef.current.start(); } catch(e){}
    resetSilenceTimer();
  };

  // 终极防翻车：长按输入兜底 (用于答辩演示时断网/无麦克风)
  const handleFallbackInput = () => {
    const fallbackText = window.prompt("【演示兜底模式】\n检测到语音环境可能不可用。\n请直接输入想对 AI 说的口语化灵感：", "我觉得现在脑子很乱，但是又有一种奇怪的放松感");
    if (fallbackText) callMinimaxAPI(fallbackText);
  };

  // 姿态确认
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cabinMode === 'pose-confirm') {
      if (isPressing) interval = setInterval(() => { setConfirmProgress(p => { if (p >= 100 && targetMode) { setCabinMode(targetMode); return 100; } return p + 2; }); }, 30);
      else interval = setInterval(() => setConfirmProgress(p => Math.max(p - 4, 0)), 30);
    } else setConfirmProgress(0);
    return () => clearInterval(interval);
  },[isPressing, cabinMode, targetMode, setCabinMode]);

  const maxTime = cabinMode === 'recharge' ? 600 : 720;
  useEffect(() => { if ((cabinMode === 'recharge' || cabinMode === 'inspiration') && timeElapsed >= maxTime) endSession(); },[timeElapsed, maxTime, cabinMode]);
  const formatTime = (seconds: number) => { const m = Math.floor(seconds / 60).toString().padStart(2, '0'); const s = (seconds % 60).toString().padStart(2, '0'); return `${m}:${s}`; };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pushProgress > 0) interval = setInterval(() => setPushProgress(p => Math.max(p - 2, 0)), 40);
    return () => clearInterval(interval);
  }, [pushProgress]);

  // 【修复】：精神充能 小球生成逻辑（动态屏幕安全区域）
  useEffect(() => {
    if (cabinMode === 'recharge') {
      const bounds = getSafeBounds();
      const generateNewBalls = () => [...Array(5)].map((_, i) => ({ 
        id: Math.random(), isConsumed: false, 
        x: (Math.random() - 0.5) * bounds.xRange, 
        y: (Math.random() - 0.5) * bounds.yRange - 30, 
        size: 0.6 + Math.random() * 0.6 
      }));
      if (balls.length === 0) setBalls(generateNewBalls());
      else if (balls.every(b => b.isConsumed)) setTimeout(() => setBalls(generateNewBalls()), 800);
    } else { setBalls([]); setPushProgress(0); }
  },[cabinMode, balls]);

  // 【修复】：灵感触发 光圈生成逻辑（动态屏幕安全区域，不再超出屏幕）
  useEffect(() => {
    if (cabinMode === 'inspiration') {
      const bounds = getSafeBounds();
      const generateSpots = () => setRandomSpots([
        { id: Math.random(), x: (Math.random() - 0.5) * bounds.xRange, y: (Math.random() - 0.5) * bounds.yRange, size: 0.6 + Math.random() * 0.8 }, 
        { id: Math.random(), x: (Math.random() - 0.5) * bounds.xRange, y: (Math.random() - 0.5) * bounds.yRange, size: 0.6 + Math.random() * 0.8 }
      ]);
      generateSpots();
      const spotInterval = setInterval(() => {
        setRandomSpots(prev => {
          if (prev.length > 3) return prev; 
          return[...prev, { id: Math.random(), x: (Math.random() - 0.5) * bounds.xRange, y: (Math.random() - 0.5) * bounds.yRange, size: 0.5 + Math.random() * 1.0 }];
        });
      }, 3000);
      return () => clearInterval(spotInterval);
    }
  }, [cabinMode]);

  const handleSpotClick = (e: React.MouseEvent | React.TouchEvent, id: number) => {
    if (cabinMode !== 'inspiration') return;
    let clientX = 0; let clientY = 0;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }

    const newRipple = { id: rippleIdRef.current++, x: clientX, y: clientY };
    setRipples(prev =>[...prev, newRipple]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== newRipple.id)), 2500);
    setRandomSpots(prev => prev.filter(s => s.id !== id));
    recordAction(); 
    
    // 重新在安全区域生成
    setTimeout(() => {
      const bounds = getSafeBounds();
      setRandomSpots(prev =>[...prev, { id: Math.random(), x: (Math.random() - 0.5) * bounds.xRange, y: (Math.random() - 0.5) * bounds.yRange, size: 0.6 + Math.random() * 0.8 }]);
    }, 500);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative h-[100dvh] flex flex-col items-center justify-center overflow-hidden w-full touch-none"
      onPointerDown={() => { if(cabinMode === 'pose-confirm') setIsPressing(true); }} 
      onPointerUp={() => setIsPressing(false)} onPointerLeave={() => setIsPressing(false)}
    >
      <div className="absolute inset-0 bg-[#4FACFE]/5 pointer-events-none" />

      <AnimatePresence>
        {cabinMode === 'ending' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }} className="absolute inset-0 z-50 bg-white/90 backdrop-blur-2xl flex flex-col items-center justify-center touch-none">
            <SyncLogo size="large" isSyncing={true} className="mb-8 scale-110 pointer-events-none" />
            <p className="text-[#333]/60 tracking-[0.4em] text-sm font-medium">舱门将在 8s 后打开</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(cabinMode === 'recharge' || cabinMode === 'inspiration') && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-32 md:top-40 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30 pointer-events-none whitespace-nowrap">
            <span className="text-white font-mono text-xl tracking-[0.2em] opacity-90" style={{ paddingLeft: '0.2em' }}>进行中 ({formatTime(timeElapsed)})</span>
          </motion.div>
        )}
        {cabinMode === 'pose-confirm' && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-32 md:top-40 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-30 pointer-events-none whitespace-nowrap">
            <span className="text-white/80 font-light md:text-lg text-sm tracking-[0.4em]" style={{ paddingLeft: '0.4em' }}>请将双手放置于引导区确认姿态</span>
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-[#4FACFE] transition-all duration-75" style={{ width: `${confirmProgress}%` }} /></div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute w-[200vw] md:w-[800px] h-[100vw] md:h-[400px] border-t-[40px] border-[#4FACFE]/10 rounded-t-full bottom-[-50px] pointer-events-none" style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }} />

      <div className="absolute bottom-[-50px] w-[200vw] md:w-[800px] h-[200vw] md:h-[800px] rounded-full flex items-center justify-center pointer-events-none z-40">
        {cabinMode === 'pose-confirm' && (
          <>
            <div className={`absolute bottom-[100px] left-[20vw] md:left-[50px] transition-all duration-300 ${isPressing ? 'scale-90 opacity-100' : 'scale-100 opacity-40'}`}>
              <Hand size={80} className="text-[#4FACFE] -rotate-12" />
              <motion.div animate={{ scale:[1, 1.2, 1], opacity:[0.2, 0.5, 0.2] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-[#4FACFE] blur-2xl rounded-full" />
            </div>
            <div className={`absolute bottom-[100px] right-[20vw] md:right-[50px] transition-all duration-300 ${isPressing ? 'scale-90 opacity-100' : 'scale-100 opacity-40'}`}>
              <Hand size={80} className="text-[#4FACFE] rotate-12" />
              <motion.div animate={{ scale:[1, 1.2, 1], opacity:[0.2, 0.5, 0.2] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-[#4FACFE] blur-2xl rounded-full" />
            </div>
          </>
        )}

        {cabinMode === 'recharge' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {balls.map((ball) => (
              !ball.isConsumed && (
                <motion.div key={ball.id} drag dragConstraints={{ left: -window.innerWidth/2+30, right: window.innerWidth/2-30, top: -window.innerHeight/2+30, bottom: window.innerHeight/2-30 }}
                  onDragEnd={(_, info) => {
                    const centerX = window.innerWidth / 2; const centerY = window.innerHeight / 2;
                    const dist = Math.sqrt(Math.pow(info.point.x - centerX, 2) + Math.pow(info.point.y - centerY, 2));
                    if (dist < 100) { 
                      setBalls(prev => prev.map(b => b.id === ball.id ? { ...b, isConsumed: true } : b)); 
                      setPushProgress(100); recordAction(); 
                    }
                  }}
                  initial={{ scale: 0, opacity: 0, x: ball.x, y: ball.y }} animate={{ scale: ball.isConsumed ? 0 : ball.size, opacity: ball.isConsumed ? 0 : 1 }} transition={{ duration: ball.isConsumed ? 0.3 : 0.8, ease: ball.isConsumed ? "backIn" : "easeOut" }}
                  className="w-12 h-12 rounded-full bg-[#4FACFE]/30 backdrop-blur-md border border-[#4FACFE]/50 cursor-grab active:cursor-grabbing pointer-events-auto shadow-[0_0_20px_rgba(79,172,254,0.3)] flex items-center justify-center touch-none" style={{ position: 'absolute' }}>
                  <motion.div animate={{ scale:[1, 1.3, 1], opacity:[0.6, 1, 0.6] }} transition={{ duration: 1.5 + (ball.id % 2) * 0.2, repeat: Infinity }} className="w-8 h-8 rounded-full bg-[#4FACFE]/60 blur-[6px]" />
                </motion.div>
              )
            ))}
            <div className="absolute w-64 h-64 rounded-full bg-[#4FACFE] blur-[60px] transition-all duration-75 pointer-events-none" style={{ opacity: (pushProgress / 100) * 0.8, transform: `scale(${0.5 + (pushProgress / 100) * 0.8})` }} />
            <div className="absolute text-center mt-[45vw] md:mt-[450px] pointer-events-none"><p className="text-[#4FACFE] tracking-[0.3em] text-xs md:text-sm">将散落的思维球拖动至中心聚拢</p></div>
          </div>
        )}

        {cabinMode === 'inspiration' && (
          <AnimatePresence>
            {randomSpots.map(spot => (
              <motion.div key={spot.id} initial={{ opacity: 0, scale: 0, x: spot.x, y: spot.y }} animate={{ opacity: 1, scale: spot.size, x: spot.x, y: spot.y }} exit={{ opacity: 0, scale: spot.size * 3, filter: 'blur(10px)' }} transition={{ duration: 0.5, ease: "easeOut" }}
                className="absolute flex items-start justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-full border border-white/30 bg-white/10 backdrop-blur-md flex items-center justify-center cursor-pointer pointer-events-auto hover:bg-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] touch-none"
                  onPointerDown={(e) => handleSpotClick(e, spot.id)}>
                  <motion.div animate={{ scale:[1, 1.5, 1], opacity:[0.8, 0, 0.8] }} transition={{ duration: 1.5 + spot.size, repeat: Infinity }} className="absolute w-4 h-4 bg-white rounded-full blur-[2px]" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
         <SyncLogo className="mb-24 scale-[0.6] md:scale-[0.8]" isSyncing={pushProgress > 20 || cabinMode === 'inspiration'} />
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {ripples.map(ripple => <div key={ripple.id} className="ripple" style={{ left: ripple.x, top: ripple.y }} />)}
      </div>

      <AnimatePresence>
        {cabinMode === 'idle' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-24 md:bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 whitespace-nowrap pointer-events-none">
            <motion.div animate={{ opacity:[0.3, 0.8, 0.3] }} transition={{ duration: 3, repeat: Infinity }}><span className="text-white/30 text-xs tracking-[0.5em] font-light" style={{ paddingLeft: '0.5em' }}>等待心跃端唤醒...</span></motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 麦克风录音控制区（增加防翻车兜底长按机制） */}
      {(cabinMode === 'recharge' || cabinMode === 'inspiration') && (
        <div 
          className="absolute bottom-16 md:bottom-12 right-6 md:right-12 flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl transition-all z-40 cursor-pointer hover:bg-white/10 active:scale-95 touch-none select-none"
          onClick={(e) => { e.stopPropagation(); startRecording(); }}
          onContextMenu={(e) => { e.preventDefault(); handleFallbackInput(); }} // 长按触发兜底输入框
        >
          {recordFeedback ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 text-[#4FACFE]">
              {isAIGenerating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span className="text-xs tracking-widest">{recordFeedback}</span>
            </motion.div>
          ) : (
            <>
              {isListening ? <motion.div animate={{ opacity:[0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}><Mic size={16} className="text-[#4FACFE]" /></motion.div> : <Mic size={16} className="text-white/50" />}
              <span className="text-xs text-white/50 tracking-widest hidden md:inline">点击或长按记录灵感</span>
              <span className="text-xs text-white/50 tracking-widest md:hidden">记录灵感</span>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ==========================================
// 3. 手机端 UI
// ==========================================
const MobileUI = ({ 
  mobileState, setMobileState, enterCabin, cabinMode, targetMode, sessionResult, endSession, generatedCards
}: { 
  mobileState: MobileState, setMobileState: (s: MobileState) => void, enterCabin: (m: CabinMode) => void, cabinMode: CabinMode, targetMode: CabinMode | null, sessionResult: SessionResult | null, endSession: () => void, generatedCards: string[]
}) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-[100dvh] pt-24 md:pt-32 px-6 md:px-8 flex flex-col items-center w-full touch-none">
      {mobileState === 'home' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md flex flex-col items-center justify-center flex-1 pb-16">
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40"><div className="fluid-blob fluid-blob-1" /><div className="fluid-blob fluid-blob-2" /></div>
          <motion.div animate={{ scale:[1, 1.05, 1], opacity:[0.8, 1, 0.8] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}><SyncLogo size="large" className="mb-12 scale-[0.8] md:scale-100" /></motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-col items-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold tracking-[0.3em] sync-text-gradient mb-2" style={{ paddingLeft: '0.3em' }}>心跃</h1>
            <h2 className="text-2xl md:text-3xl font-bold tracking-[0.4em] sync-text-gradient opacity-90" style={{ paddingLeft: '0.4em' }}>SYNC</h2>
          </motion.div>
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} onPointerDown={() => setMobileState('modeSelect')} 
            className="px-12 py-4 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl text-white font-light tracking-[0.4em] hover:bg-white/10 transition-all active:scale-95" style={{ paddingLeft: 'calc(3rem + 0.4em)' }}>进入系统</motion.button>
        </motion.div>
      )}

      {mobileState === 'modeSelect' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md flex flex-col items-center">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-xl md:text-2xl font-light tracking-[0.4em] text-white/90 mb-2" style={{ paddingLeft: '0.4em' }}>选择同步模式</h2>
            <div className="h-px w-12 bg-[#4FACFE]/50 mx-auto mt-4" />
          </div>
          <div className="w-full space-y-4 md:space-y-6">
            <motion.button onPointerDown={() => enterCabin('recharge')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full bg-[#1A1A1A] border border-white/10 rounded-[32px] p-6 md:p-8 flex flex-col items-start gap-4 hover:bg-white/5 transition-all">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#4FACFE]/10 flex items-center justify-center mb-2"><Zap size={20} className="text-[#4FACFE]" /></div>
              <div className="text-left"><h3 className="text-lg md:text-xl font-medium tracking-[0.3em] text-white mb-2" style={{ paddingLeft: '0.3em' }}>精神充能</h3><p className="text-white/40 text-[10px] md:text-xs tracking-widest font-light">10min · 深度意识修复</p></div>
            </motion.button>
            <motion.button onPointerDown={() => enterCabin('inspiration')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full bg-[#1A1A1A] border border-white/10 rounded-[32px] p-6 md:p-8 flex flex-col items-start gap-4 hover:bg-white/5 transition-all">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#4FACFE]/10 flex items-center justify-center mb-2"><Sparkles size={20} className="text-[#4FACFE]" /></div>
              <div className="text-left"><h3 className="text-lg md:text-xl font-medium tracking-[0.3em] text-white mb-2" style={{ paddingLeft: '0.3em' }}>灵感触发</h3><p className="text-white/40 text-[10px] md:text-xs tracking-widest font-light">12min · 创意频率同步</p></div>
            </motion.button>
          </div>
        </motion.div>
      )}

      {mobileState === 'activeInCabin' && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center flex-1 w-full pb-20">
          <div className="relative flex items-center justify-center mb-16"><motion.div animate={{ scale:[1, 1.3, 1], opacity:[0.1, 0.3, 0.1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute w-48 md:w-64 h-48 md:h-64 bg-[#4FACFE] rounded-full blur-[50px]" /><SyncLogo size="small" isSyncing={true} /></div>
          <h2 className="text-xl md:text-2xl font-light tracking-[0.3em] text-white mb-4 shadow-black drop-shadow-lg" style={{ paddingLeft: '0.3em' }}>{cabinMode === 'pose-confirm' ? '等待姿态确认...' : '交互舱同步中'}</h2>
          <p className="text-[#4FACFE] text-xs md:text-sm tracking-[0.5em] font-medium uppercase mb-12" style={{ paddingLeft: '0.5em' }}>{targetMode === 'recharge' ? '精神充能模式' : '灵感触发模式'}</p>
          <button onPointerDown={endSession} className="flex items-center gap-2 px-8 py-3 rounded-full border border-white/10 text-white/40 hover:text-white/80 hover:bg-white/5 transition-all text-xs tracking-widest active:scale-95"><Power size={14} /> 提前结束</button>
        </motion.div>
      )}

      {mobileState === 'result' && sessionResult && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md flex flex-col items-center flex-1 pt-6 md:pt-12 pb-12">
          <motion.div animate={{ opacity:[0.5, 1, 0.5] }} transition={{ duration: 4, repeat: Infinity }} className="mb-8 w-full flex justify-center"><SyncLogo size="small" /></motion.div>
          <h2 className="text-lg md:text-xl text-white/90 tracking-[0.4em] font-light mb-8" style={{ paddingLeft: '0.4em' }}>祝您旅程愉快</h2>

          <div className="w-full bg-[#1A1A1A] rounded-3xl p-6 md:p-8 flex flex-col items-center gap-6 border border-white/5 shadow-2xl mb-8">
            <div className="text-center w-full"><p className="text-white/40 text-[10px] tracking-[0.3em] mb-2 uppercase" style={{ paddingLeft: '0.3em' }}>本次 MoodScore</p><h3 className="text-4xl md:text-5xl font-semibold text-[#4FACFE] tracking-widest drop-shadow-[0_0_15px_rgba(79,172,254,0.4)]" style={{ paddingLeft: '0.1em' }}>{sessionResult.score}</h3></div>
            <div className="w-full h-px bg-white/5 my-2" />
            <div className="w-full flex justify-between px-2 md:px-4">
              <div className="text-center flex-1 border-r border-white/5"><p className="text-white/40 text-[10px] tracking-widest mb-2">{sessionResult.mode === 'recharge' ? '精神充能' : '灵感触发'}</p><p className="text-white/90 font-medium tracking-wider text-base md:text-lg">+{sessionResult.percent}%</p></div>
              <div className="text-center flex-1"><p className="text-white/40 text-[10px] tracking-widest mb-2">灵感记录</p><p className="text-white/90 font-medium tracking-wider text-base md:text-lg">+{sessionResult.cards}</p></div>
            </div>
          </div>

          <div className="flex w-full gap-4 mt-auto">
            <button onPointerDown={() => setMobileState('home')} className="flex-1 py-4 rounded-2xl border border-white/10 bg-[#111] text-white/60 tracking-widest hover:text-white transition-all text-xs md:text-sm font-light active:scale-95">返回主页</button>
            <button onPointerDown={() => setMobileState('cardsView')} className="flex-1 py-4 rounded-2xl bg-[#4FACFE]/10 border border-[#4FACFE]/30 text-[#4FACFE] tracking-widest transition-all text-xs md:text-sm font-light active:scale-95">查看卡片</button>
          </div>
        </motion.div>
      )}

      {mobileState === 'cardsView' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md flex flex-col gap-4 md:gap-6 pt-6 md:pt-12 flex-1 pb-12">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg md:text-xl tracking-[0.2em] font-light" style={{ paddingLeft: '0.2em' }}>记录的灵感</h2><button onPointerDown={() => setMobileState('result')} className="text-[#4FACFE] text-[10px] md:text-xs tracking-widest transition-colors active:opacity-50">← 返回结算</button></div>
          <div className="space-y-4 overflow-y-auto">
            {generatedCards.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="p-5 md:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#4FACFE]/10 blur-2xl -mr-12 -mt-12" /><Sparkles size={16} className="text-[#4FACFE] mb-3 opacity-60" /><p className="italic text-white/80 leading-relaxed font-light text-xs md:text-sm">"{c}"</p>
              </motion.div>
            ))}
            {generatedCards.length === 0 && <div className="p-8 text-center border border-white/5 rounded-2xl bg-white/5"><p className="text-white/20 tracking-widest text-xs md:text-sm">本次体验未记录任何灵感</p></div>}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

// ==========================================
// 4. 主应用路由
// ==========================================
export default function App() {
  const[view, setView] = useState<'cabin' | 'mobile'>('mobile');
  const[cabinMode, setCabinMode] = useState<CabinMode>('idle');
  const [targetMode, setTargetMode] = useState<CabinMode | null>(null);
  const [mobileState, setMobileState] = useState<MobileState>('home');
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const[timeElapsed, setTimeElapsed] = useState(0);
  const [generatedCards, setGeneratedCards] = useState<string[]>([]);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  
  const [actionCount, setActionCount] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cabinMode === 'recharge' || cabinMode === 'inspiration') interval = setInterval(() => setTimeElapsed(p => p + 1), 1000);
    else setTimeElapsed(0);
    return () => clearInterval(interval);
  }, [cabinMode]);

  const enterCabin = (mode: CabinMode) => {
    setIsTransitioning(true); setGeneratedCards([]); setActionCount(0); setTargetMode(mode);
    setTimeout(() => { setView('cabin'); setCabinMode('pose-confirm'); setMobileState('activeInCabin'); }, 1200);
    setTimeout(() => setIsTransitioning(false), 2200);
  };

  const endSession = () => {
    const maxTime = targetMode === 'recharge' ? 600 : 720;
    const baseScore = 4.0;
    const percent = Math.min(Math.round((timeElapsed / maxTime) * 100), 100);
    const timeScore = (percent / 100) * 3.0;
    const targetActions = targetMode === 'recharge' ? 15 : 20;
    const actionScore = Math.min((actionCount / targetActions) * 2.0, 2.0);
    const cardScore = Math.min(generatedCards.length * 0.5, 1.0);
    const finalScore = (baseScore + timeScore + actionScore + cardScore).toFixed(1);

    setSessionResult({ mode: targetMode || 'recharge', percent: percent === 0 ? 1 : percent, score: finalScore, cards: generatedCards.length });
    setView('cabin'); setCabinMode('ending');
    setTimeout(() => { setCabinMode('idle'); setTargetMode(null); setMobileState('result'); setView('mobile'); }, 8000);
  };

  return (
    <div className="min-h-[100dvh] bg-[#111] text-white selection:bg-[#4FACFE]/30 flex flex-col font-sans touch-none">
      <nav className="fixed top-8 left-1/2 -translate-x-1/2 z-50 flex gap-2 p-1.5 bg-white/5 border border-white/10 backdrop-blur-md rounded-full">
        <button onPointerDown={() => setView('cabin')} className={`px-4 md:px-6 py-2.5 rounded-full transition-all duration-500 flex items-center gap-2 md:gap-2.5 ${view === 'cabin' ? 'bg-[#4FACFE] text-white shadow-[0_0_20px_rgba(79,172,254,0.3)]' : 'text-white/40 hover:text-white/80'}`}>
          <Monitor size={16} /><span className="text-[10px] md:text-xs font-semibold tracking-wider">交互舱</span>
        </button>
        <button onPointerDown={() => setView('mobile')} className={`px-4 md:px-6 py-2.5 rounded-full transition-all duration-500 flex items-center gap-2 md:gap-2.5 ${view === 'mobile' ? 'bg-[#4FACFE] text-white shadow-[0_0_20px_rgba(79,172,254,0.3)]' : 'text-white/40 hover:text-white/80'}`}>
          <Smartphone size={16} /><span className="text-[10px] md:text-xs font-semibold tracking-wider">心跃端</span>
        </button>
      </nav>

      <AnimatePresence mode="wait">
        {view === 'cabin' ? (
          <CabinUI key="cabin" cabinMode={cabinMode} setCabinMode={setCabinMode} targetMode={targetMode} addCard={(t) => setGeneratedCards(p =>[...p, t])} timeElapsed={timeElapsed} endSession={endSession} recordAction={() => setActionCount(p => p + 1)} />
        ) : (
          <MobileUI key="mobile" mobileState={mobileState} setMobileState={setMobileState} enterCabin={enterCabin} cabinMode={cabinMode} targetMode={targetMode} sessionResult={sessionResult} endSession={endSession} generatedCards={generatedCards} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTransitioning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111] pointer-events-none">
            <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ scale: 30, opacity: 0 }} transition={{ duration: 2, ease: "circIn" }} className="w-32 h-32 bg-[#4FACFE] rounded-full blur-[40px]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}