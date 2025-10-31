// src/components/AIEngineTest.tsx [最终版]

import { useState } from 'react';
// 导入我们的大脑
// (路径../services/aiService 是正确的)
import { parseUserIntent, type RunGeniusIntent } from '../services/aiService';

export function AIEngineTest() {
  const [input, setInput] = useState<string>("我想在旧金山跑个5公里，要安全且有路灯"); // 输入框内容
  const [result, setResult] = useState<RunGeniusIntent | null>(null); // 存放 AI 返回的 JSON
  const [isLoading, setIsLoading] = useState<boolean>(false); // 是否正在解析

  // 按钮点击事件
  const handleParse = async () => {
    setIsLoading(true);
    setResult(null);
    
    // 调用我们的大脑
    const parsedData = await parseUserIntent(input);
    
    setIsLoading(false);
    if (parsedData) {
      setResult(parsedData);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>RunGenius - AI 核心测试 (挑战 A)</h1>
      <hr />
      
      <h3>1. 测试意图解析 (Prompt API)</h3>
      <p>在这里输入你最复杂的跑步需求，测试 AI 能否看懂：</p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        style={{ width: '100%', padding: '10px' }}
      />
      <br />
      <button onClick={handleParse} disabled={isLoading} style={{ padding: '10px 20px', marginTop: '10px', cursor: 'pointer' }}>
        {isLoading ? '正在解析...' : '解析意图'}
      </button>

      <h3>2. 解析结果 (V2 JSON)</h3>
      <pre style={{ backgroundColor: '#f4f4f4', padding: '15px', borderRadius: '8px' }}>
        {result ? JSON.stringify(result, null, 2) : '点击按钮以查看结果'}
      </pre>
    </div>
  );
}