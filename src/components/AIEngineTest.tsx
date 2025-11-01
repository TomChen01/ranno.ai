// src/components/AIEngineTest.tsx [Final test harness]

import { useState } from 'react';
// Import the intent parser helper
// (Path ../services/aiService is correct)
import { parseUserIntent, type RunGeniusIntent } from '../services/aiService';

export function AIEngineTest() {
  const [input, setInput] = useState<string>('I want to run 3 mile in San Francisco with good lighting and safety.');
  const [result, setResult] = useState<RunGeniusIntent | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleParse = async () => {
    setIsLoading(true);
    setResult(null);

    const parsedData = await parseUserIntent(input);

    setIsLoading(false);
    if (parsedData) {
      setResult(parsedData);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>RunGenius - AI Core Test (Challenge A)</h1>
      <hr />

      <h3>1. Intent parsing test (Prompt API)</h3>
      <p>Enter your most complex running request to see whether the AI understands it:</p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        style={{ width: '100%', padding: '10px' }}
      />
      <br />
      <button onClick={handleParse} disabled={isLoading} style={{ padding: '10px 20px', marginTop: '10px', cursor: 'pointer' }}>
        {isLoading ? 'Parsing...' : 'Parse intent'}
      </button>

      <h3>2. Parsed result (V2 JSON)</h3>
      <pre style={{ backgroundColor: '#f4f4f4', padding: '15px', borderRadius: '8px' }}>
        {result ? JSON.stringify(result, null, 2) : 'Click the button to view results'}
      </pre>
    </div>
  );
}