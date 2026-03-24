import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import MobileApp from './MobileApp';
import CabinApp from './CabinApp';
import './index.css';

// 首页选择器 - 自动检测设备并显示对应入口
function HomeSelector() {
  const [autoNavigate, setAutoNavigate] = useState(false);
  
  useEffect(() => {
    // 首次加载时，自动检测设备并跳转
    if (!autoNavigate) {
      setAutoNavigate(true);
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.hash = '#mobile';
      } else {
        window.location.hash = '#cabin';
      }
    }
  }, [autoNavigate]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">
        SYNC · 心跃
      </h1>
      <p className="text-gray-400 mb-6">正在跳转到正确页面...</p>
      <div className="text-white text-sm text-gray-500">如果没有自动跳转，请手动选择：</div>
      
      <div className="flex flex-col gap-4 mt-6 w-full max-w-xs">
        <a
          href="#cabin"
          className="p-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/40 rounded-2xl text-center"
        >
          <div className="text-2xl mb-2">🖥️</div>
          <div className="text-white font-semibold">舱内大屏</div>
          <div className="text-gray-400 text-sm">展位大屏展示</div>
        </a>
        
        <a
          href="#mobile"
          className="p-6 bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/40 rounded-2xl text-center"
        >
          <div className="text-2xl mb-2">📱</div>
          <div className="text-white font-semibold">手机遥控</div>
          <div className="text-gray-400 text-sm">扫码连接舱内大屏</div>
        </a>
      </div>
    </div>
  );
}

// 根据 URL hash 判断加载哪个 App
function getAppFromHash() {
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  if (hash === 'mobile') return MobileApp;
  if (hash === 'cabin') return CabinApp;
  return null;
}

// 初始化
let EntryApp = getAppFromHash() || HomeSelector;

// 监听 hash 变化
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const newApp = getAppFromHash();
    if (newApp) {
      window.location.reload();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EntryApp />
  </React.StrictMode>
);
