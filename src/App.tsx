// src/App.tsx [最终完整版 - 守卫 + 加载器]

import { useState, useEffect, useCallback } from 'react';
import { AIEngineTest } from './components/AIEngineTest'; // <-- 导入我们的测试台

// 声明 Chrome 注入的全局 API
// @ts-ignore
declare var LanguageModel: any;
// @ts-ignore
declare var Summarizer: any; // 我们仍然用 Summarizer 来触发下载，因为它最稳定

type ModelStatus = 
  | 'LOADING...'
  | 'available' 
  | 'downloadable' 
  | 'downloading' 
  | 'unavailable' 
  | string;

function App() {
  const [status, setStatus] = useState<ModelStatus>('LOADING...');

  // 检查模型状态的函数
  const checkModelStatus = useCallback(async () => {
    if (typeof LanguageModel === 'undefined' || typeof LanguageModel.availability !== 'function') {
      setStatus('ERROR: LanguageModel API not found');
      return;
    }
    try {
      const modelStatus = await LanguageModel.availability();
      setStatus(modelStatus);
    } catch (error) {
      setStatus('ERROR: Failed to check availability');
      console.error(error);
    }
  }, []);

  // 在组件挂载时，自动检查一次状态
  useEffect(() => {
    checkModelStatus();
  }, [checkModelStatus]);

  // 处理用户激活和下载的函数
  const handleActivateAndDownload = async () => {
    if (typeof Summarizer === 'undefined' || typeof Summarizer.create !== 'function') {
      setStatus('ERROR: Summarizer API not found. Cannot trigger download.');
      return;
    }

    console.log('User activated. Attempting to create session to trigger download...');
    setStatus('downloading');

    try {
      // @ts-ignore
      const session = await Summarizer.create();
      console.log('Session created or download triggered.', session);
      await checkModelStatus(); // 触发后，再次检查状态
    } catch (error) {
      setStatus('ERROR: Failed to create session / trigger download');
      console.error(error);
    }
  };

  // 渲染 UI
  return (
    <div>
      {/* 核心逻辑：如果可用，渲染测试台。否则，显示加载器。 */}

      {status === 'available' ? (
        // [!! 关键 !!] 状态可用，加载我们的核心功能组件！
        <AIEngineTest />
      ) : (
        // 状态不可用时，显示加载/下载界面
        <div style={{ padding: '40px', fontFamily: 'sans-serif', fontSize: '18px' }}>
          <h1>AI Model Loader</h1>
          <p>Current Status: <strong>{status.toUpperCase()}</strong></p>
          <hr />
          
          {status === 'LOADING...' && <p>Checking model availability...</p>}

          {status === 'unavailable' && (
            <p style={{ color: 'orange' }}>
              AI model is unavailable on this device.
            </p>
          )}

          {status === 'downloadable' && (
            <div>
              <p style={{ color: 'blue' }}>
                Model is ready to be downloaded. User activation is required.
              </p>
              <button onClick={handleActivateAndDownload}>
                Activate AI Features (Trigger Download)
              </button>
            </div>
          )}

          {status === 'downloading' && (
            <div>
              <p style={{ color: 'purple' }}>
                Model is downloading, please wait...
              </p>
              <button onClick={checkModelStatus}>Refresh Status</button>
            </div>
          )}

          {status.startsWith('ERROR:') && (
            <p style={{ color: 'red' }}>{status}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;