// src/App.tsx [最终完整版 - 守卫 + 加载器]

import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { MainApp } from './components/MainApp';
import { getLanguageModel, getSummarizer, type ModelStatus } from './services/promptApi';

function App() {
  const [status, setStatus] = useState<ModelStatus>('LOADING...');

  // 检查模型状态的函数
  const checkModelStatus = useCallback(async () => {
    const languageModel = getLanguageModel();

    if (!languageModel || typeof languageModel.availability !== 'function') {
      setStatus('ERROR: LanguageModel API not found');
      return;
    }
    try {
      const modelStatus = await languageModel.availability();
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
    const summarizer = getSummarizer();

    if (!summarizer || typeof summarizer.create !== 'function') {
      setStatus('ERROR: Summarizer API not found. Cannot trigger download.');
      return;
    }

    console.log('User activated. Attempting to create session to trigger download...');
    setStatus('downloading');

    try {
      const session = await summarizer.create();
      console.log('Session created or download triggered.', session);
      await checkModelStatus(); // 触发后，再次检查状态
    } catch (error) {
      setStatus('ERROR: Failed to create session / trigger download');
      console.error(error);
    }
  };

  // 渲染 UI
  return (
    <div className="app-guard">
      {status === 'available' ? (
        <MainApp />
      ) : (
        <div className="loader-panel">
          <h1>AI Model Loader</h1>
          <p>
            Current Status: <strong>{status.toUpperCase()}</strong>
          </p>
          <hr />

          {status === 'LOADING...' && <p>Checking model availability...</p>}

          {status === 'unavailable' && (
            <p className="loader-warning">AI model is unavailable on this device.</p>
          )}

          {status === 'downloadable' && (
            <div>
              <p className="loader-info">Model is ready to be downloaded. User activation is required.</p>
              <button onClick={handleActivateAndDownload}>Activate AI Features (Trigger Download)</button>
            </div>
          )}

          {status === 'downloading' && (
            <div>
              <p className="loader-progress">Model is downloading, please wait...</p>
              <button onClick={checkModelStatus}>Refresh Status</button>
            </div>
          )}

          {status.startsWith('ERROR:') && <p className="loader-error">{status}</p>}
        </div>
      )}
    </div>
  );
}

export default App;