// src/services/aiService.ts

import { getLanguageModel } from './promptApi';

/**
 * RunGenius V2 意图接口 (我们的“订单”)
 * 这是从用户自然语言中解析出的结构化数据，
 * 驱动整个应用的核心逻辑。
 * 注意: 这个接口定义应该放在一个共享的 types.ts 文件中以便复用,
 * 但为了在 Prompt 中清晰展示，我们在这里也保留一份。
 */
export interface RunGeniusIntent {
  location?: {
    origin?: { text: string };          // e.g., "我的酒店", "渡轮大厦"
    destination?: { text: string };    // e.g., "联合广场", or null for loop/area runs
    context?: string;                  // e.g., "在金门公园里", "海斯谷附近"
    points_of_interest?: { text: string }[]; // 用户希望途径的地点
  };

  constraints?: {
    distance_km?: number;         // 目标距离 (公里)
    duration_minutes?: number;    // 目标时长 (分钟)
    time_of_day?: string;         // 跑步的具体时间, e.g., "21:00", "07:00"
  };

  preferences?: {
    route_type?: 'loop' | 'point_to_point';
    incline?: 'low' | 'medium' | 'high';
    surface?: ('paved' | 'trail' | 'track')[];
    safety?: ('avoid_high_crime_areas' | 'prefer_well_lit_streets')[];
    environment?: ('prefer_shaded_paths' | 'avoid_heavy_traffic' | 'prefer_low_traffic')[];
    scenery?: ('water_view' | 'bridge_view' | 'park_view' | 'cityscape')[];
    vibe?: 'quiet' | 'lively';
    amenities?: ('has_restrooms' | 'has_water_fountains')[];
  };
}

/**
 * [我的核心任务] 核心函数：解析用户意图
 * @param userInput 用户输入的自然语言字符串
 * @returns 一个 Promise，解析成功时返回 RunGeniusIntent 对象，否则返回 null
 */
export async function parseUserIntent(userInput: string): Promise<RunGeniusIntent | null> {
  // 检查 create 函数是否存在
  const languageModel = getLanguageModel();
  if (!languageModel || typeof languageModel.create !== 'function') {
    console.error("Global 'LanguageModel.create' function not found.");
    alert('AI create function (LanguageModel.create) not found.');
    return null;
  }

  // --- [核心升级] 这是我们强化后的最终版 Prompt (提示词) ---
  const systemPrompt = `
    You are an expert running route assistant for an application named RunGenius.
    Your sole task is to parse the user's natural language request into a structured JSON object.
    You must adhere STRICTLY to the following TypeScript interface. Omit any fields that are not mentioned by the user.

    // --- TYPE DEFINITION START ---
    interface RunGeniusIntent {
      location?: {
        origin?: { text: string };
        destination?: { text: string };
        context?: string;
        points_of_interest?: { text: string }[];
      };
      constraints?: {
        distance_km?: number;
        duration_minutes?: number;
        time_of_day?: string;
      };
      preferences?: {
        route_type?: 'loop' | 'point_to_point';
        incline?: 'low' | 'medium' | 'high';
        surface?: ('paved' | 'trail' | 'track')[];
        safety?: ('avoid_high_crime_areas' | 'prefer_well_lit_streets')[];
        environment?: ('prefer_shaded_paths' | 'avoid_heavy_traffic' | 'prefer_low_traffic')[];
        scenery?: ('water_view' | 'bridge_view' | 'park_view' | 'cityscape')[];
        vibe?: 'quiet' | 'lively';
        amenities?: ('has_restrooms' | 'has_water_fountains')[];
      };
    }
    // --- TYPE DEFINITION END ---

    // --- RULES & EXAMPLES ---
    - Location: If a specific start and end point are given (e.g., "from A to B"), use 'location.origin' and 'location.destination'. If a general area is given (e.g., "near Golden Gate Park"), use 'location.context'.
    - Time Inference: If the user says "tonight at 9", "9pm", or "this evening at nine", infer the time and set constraints.time_of_day to "21:00".
    - Safety:
      - For general terms like "safe", "safety", or "secure", ALWAYS add "avoid_high_crime_areas" to preferences.safety.
      - If the user is running at night (inferred from time_of_day) or specifically mentions "lit" or "well-lit", ALWAYS add "prefer_well_lit_streets" to preferences.safety.
    - Incline: Map "flat", "no hills", "level ground" to incline: "low". Map "hilly", "hills", "climb", "challenging" to incline: "high".
    - Route Type: Map "loop", "circle", "round trip", "back to my start" to route_type: "loop". Map "from A to B", "one-way" to route_type: "point_to_point".
    - Scenery: If "ocean", "water", "bay", or "coast" is mentioned, add "water_view". If "Golden Gate Bridge" is mentioned, add "bridge_view". If "park" or "greenery" is mentioned, add "park_view".

    Respond ONLY with the valid JSON object. Do not include any explanatory text, markdown formatting like \`\`\`json, or anything other than the raw JSON object itself.
  `;
  // --- Prompt 结束 ---

  try {
    // 1. 创建一个 Prompt API 会话 (基于文档)
    const session = await languageModel.create({
      initialPrompts: [
        { role: 'system', content: systemPrompt }
      ],
      expectedInputs: [
        { type: "text", languages: ["en" /* system prompt */, "en" /* user prompt */] }
      ],
      expectedOutputs: [
        { type: "text", languages: ["en"] }  // 输出JSON格式的英文结果
      ]
    });
    
    // 2. 发送用户输入
    const result = await session.prompt(userInput);

    // 3. 清理并解析 AI 返回的字符串为 JSON 对象
    const jsonResult = result.replace(/```json|```/g, "").trim();
    const parsedResult: RunGeniusIntent = JSON.parse(jsonResult);
    
    console.log("✅ AI Parsed Intent:", parsedResult); // 在控制台打印成功解析的结果
    return parsedResult;

  } catch (error) {
    console.error("❌ Error parsing user intent:", error);
    alert(`AI parsing failed. Please try rephrasing your request.\n\nError: ${error}`);
    return null;
  }
}