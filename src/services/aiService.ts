// src/services/aiService.ts [V4 - 最终版]

import { getLanguageModel } from './promptApi';

// V2 JSON 接口 (我们的“订单”)
export interface RunGeniusIntent {
  constraints: {
    distance_km?: number;
    duration_min?: number;
    route_type?: 'loop' | 'out_and_back';
    time_of_day?: string;
  };
  location: {
    context: string;
  };
  preferences: {
    incline?: 'low' | 'medium' | 'high';
    surface?: string[];
    safety?: string[];
    environment?: string[];
  };
  poi: {
    include?: { type: string, value: string }[];
    avoid?: { type: string, description: string }[];
  };
}

/**
 * [你的核心任务] 核心函数：解析用户意图
 */
export async function parseUserIntent(userInput: string): Promise<RunGeniusIntent | null> {
  // 检查 create 函数是否存在
  const languageModel = getLanguageModel();
  if (!languageModel || typeof languageModel.create !== 'function') {
    console.error("Global 'LanguageModel.create' function not found.");
    alert('AI create function (LanguageModel.create) not found.');
    return null;
  }

  // --- 这是我们的核心 Prompt (提示词) ---
  const systemPrompt = `
    You are an expert running route assistant.
    Your task is to parse the user's natural language request into a structured JSON object.
    You must strictly follow this TypeScript interface:
    
    interface RunGeniusIntent {
      constraints: { distance_km?: number; duration_min?: number; route_type?: 'loop' | 'out_and_back'; time_of_day?: string; };
      location: { context: string; };
      preferences: { incline?: 'low' | 'medium' | 'high'; surface?: string[]; safety?: string[]; environment?: string[]; };
      poi: { include?: { type: string, value: string }[]; avoid?: { type: string, description: string }[]; };
    }

    - location.context MUST be the city or area mentioned (e.g., "San Francisco, Mission District").
    - If the user mentions "safe", "safety", or "night run", add "avoid_high_crime_areas" to preferences.safety.
    - If the user mentions "lit" or "well-lit", add "well_lit" to preferences.safety.
    
    Respond ONLY with the valid JSON object. Do not include "json", markdown backticks, or any other explanatory text.
  `;
  // --- Prompt 结束 ---

  try {
    // 1. 创建一个 Prompt API 会话 (基于文档)
    const session = await languageModel.create({
      initialPrompts: [
        { role: 'system', content: systemPrompt }
      ]
    });
    
    // 2. 发送用户输入
    const result = await session.prompt(userInput);

    // 3. 清理并解析
    const jsonResult = result.replace(/```json|```/g, "").trim();
    const parsedResult: RunGeniusIntent = JSON.parse(jsonResult);
    
    console.log("AI Parsed Intent:", parsedResult); // 在控制台打印结果
    return parsedResult;

  } catch (error) {
    console.error("Error parsing user intent:", error);
    alert(`AI 解析失败: ${error}`);
    return null;
  }
}