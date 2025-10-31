// src/services/aiService.ts

/*
 * =================================================================
 * 1. 定义我们的 V2 JSON 结构 (TypeScript Interface)
 * 这是我们项目的“数据蓝图”。
 * =================================================================
 */
export interface RunGeniusIntent {
  constraints: {
    distance_km?: number;
    duration_min?: number;
    route_type?: 'loop' | 'out_and_back';
    time_of_day?: string; // e.g., "21:00" for "9pm"
  };
  location: {
    context: string; // e.g., "San Francisco, Mission District"
  };
  preferences: {
    incline?: 'low' | 'medium' | 'high';
    surface?: string[]; // 'paved', 'trail'
    safety?: string[]; // 'well_lit', 'avoid_high_crime_areas'
    environment?: string[]; // 'scenery_park', 'shade'
  };
  poi: {
    include?: { type: string, value: string }[];
    avoid?: { type: string, description: string }[];
  };
}

/*
 * =================================================================
 * 2. 检查 AI API 是否可用的辅助函数
 * (window.model 是 Chrome 浏览器注入的，所以我们要用 @ts-ignore)
 * =================================================================
 */
export function canUseAI(): boolean {
  // @ts-ignore
  return (typeof window.model !== 'undefined' && typeof window.model.createSession === 'function');
}

/*
 * =================================================================
 * 3. 你的核心函数：解析用户意图 (挑战 A)
 * =================================================================
 */
export async function parseUserIntent(userInput: string): Promise<RunGeniusIntent | null> {
  if (!canUseAI()) {
    console.error("Built-in AI API (window.model.createSession) is not available.");
    alert("AI 功能不可用。请确保您使用的是最新版 Chrome (Canary/Dev) 并已启用相关实验性标志。");
    return null;
  }

  // --- 这是我们的核心 Prompt (提示词) ---
  // 你未来的主要工作就是不断打磨这个 Prompt，让它更智能
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
    // 1. 创建 AI 会话
    // @ts-ignore
    const session = await window.model.createSession({
      systemInstruction: systemPrompt
    });
    
    // 2. 发送用户输入
    const result = await session.prompt(userInput);

    // 3. 清理并解析 AI 的返回结果
    // (Nano 有时还是会返回 ```json ... ```, 我们要清理掉)
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