// src/App.tsx
import { useState } from 'react';
import './App.css'; // 我们会清理这个 CSS

// 导入我们刚才写的函数和类型
import { canUseAI, parseUserIntent, type RunGeniusIntent } from './services/aiService.ts';

function App() {
  const [input, setInput] = useState<string>("我想在旧金山跑个5公里，要安全且有路灯"); // 输入框内容
  const [result, setResult] = useState<RunGeniusIntent | null>(null); // 存放 AI 返回的 JSON
  const [isLoading, setIsLoading] = useState<boolean>(false); // 是否正在加载
  const aiAvailable = canUseAI(); // 检查 AI 是否可用

  // 按钮点击事件
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
      <h1>RunGenius - AI 核心测试</h1>
      <hr />
      
      <h3>1. 检查 AI API (Prompt API)</h3>
      <p>AI 功能是否可用: {aiAvailable ? '✅ 是' : '❌ 否 (请检查 Chrome 版本和 flags)'}</p>
      
      <h3>2. 测试意图解析</h3>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        style={{ width: '100%', padding: '10px' }}
      />
      <br />
      <button onClick={handleParse} disabled={!aiAvailable || isLoading} style={{ padding: '10px 20px', marginTop: '10px' }}>
        {isLoading ? '正在解析...' : '解析意图'}
      </button>

      <h3>3. 解析结果 (V2 JSON)</h3>
      <pre style={{ backgroundColor: '#f4f4f4', padding: '15px', borderRadius: '8px' }}>
        {/* 将 JSON 格式化显示在屏幕上 */}
        {result ? JSON.stringify(result, null, 2) : '点击按钮以查看结果'}
      </pre>
    </div>
  );
}

export default App;