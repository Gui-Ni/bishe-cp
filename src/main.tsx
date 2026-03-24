import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MobileApp from './MobileApp';
import CabinApp from './CabinApp';
import './index.css';

// 根据路径判断加载哪个 App
const path = window.location.pathname;

let EntryApp: React.ComponentType;
if (path.includes('/mobile')) {
  EntryApp = MobileApp;
} else if (path.includes('/cabin')) {
  EntryApp = CabinApp;
} else {
  // 默认显示选择界面
  EntryApp = HomeSelector;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EntryApp />
  </React.StrictMode>
);

// 首页选择器
function HomeSelector() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">
        SYNC · 心跃
      </h1>
      <p className="text-gray-400 mb-12">选择运行模式</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* 舱内大屏 */}
        <a
          href="/cabin"
          className="group p-8 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-3xl hover:border-blue-500/60 transition-all"
        >
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">舱内大屏</h2>
          <p className="text-gray-400 text-sm">沉浸式体验界面，用于展位大屏展示</p>
          <div className="mt-4 text-blue-400 text-sm">进入舱内模式 →</div>
        </a>

        {/* 手机遥控 */}
        <a
          href="/mobile"
          className="group p-8 bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-3xl hover:border-orange-500/60 transition-all"
        >
          <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">手机遥控</h2>
          <p className="text-gray-400 text-sm">扫码连接舱内大屏，作为遥控器控制体验</p>
          <div className="mt-4 text-orange-400 text-sm">进入手机模式 →</div>
        </a>
      </div>

      <div className="mt-12 text-center text-gray-500 text-sm">
        <p>部署后访问：</p>
        <p className="font-mono mt-1">
          <span className="text-blue-400">/cabin</span> 舱内大屏 &nbsp;|&nbsp; <span className="text-orange-400">/mobile</span> 手机遥控
        </p>
      </div>
    </div>
  );
}
