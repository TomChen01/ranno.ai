// src/App.tsx [Guard + loader + data preload]

import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { MainApp } from './components/MainApp';
import { getLanguageModel, getSummarizer, type ModelStatus } from './services/promptApi';
import { fetchCrimePoints } from './services/crimeService';
import type { CrimePoint } from './services/crimeService';

function App() {
  const [status, setStatus] = useState<ModelStatus>('LOADING...');
  const [crimeData, setCrimeData] = useState<CrimePoint[]>([]);
  const [crimeError, setCrimeError] = useState<string | null>(null);

  const preloadCrimeData = useCallback(async () => {
    setCrimeError(null);
    try {
      const points = await fetchCrimePoints();
      setCrimeData(points);
      console.log(`Preloaded ${points.length} crime points successfully.`);
    } catch (error) {
      setCrimeError(error instanceof Error ? error.message : String(error));
      console.error('Failed to preload crime data:', error);
    }
  }, []);

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

  useEffect(() => {
    checkModelStatus();
    preloadCrimeData();
  }, [checkModelStatus, preloadCrimeData]);

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
      await checkModelStatus();
    } catch (error) {
      setStatus('ERROR: Failed to create session / trigger download');
      console.error(error);
    }
  };

  return (
    <div className="app-guard">
      {crimeError && (
        <div className="crime-error" style={{color: 'red', marginBottom: '1em'}}>
          Failed to load crime data: {crimeError}
        </div>
      )}
      {status === 'available' ? (
        <MainApp crimePoints={crimeData} />
      ) : (
        <div className="loader-panel">
          <h1>AI Model Loader</h1>
          <p>
            Current Status: <strong>{status.toUpperCase()}</strong>
          </p>
          <hr />

          {status === 'LOADING...' && <p>Checking model availability & preloading data...</p>}

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