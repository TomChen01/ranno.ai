// src/services/aiService.ts

import { getLanguageModel } from './promptApi';

/**
 * RunGenius V2 intent interface (our structured "order").
 * Parsed from natural language and used to drive the core application logic.
 * Ideally this interface would live in a shared types module, but it is
 * duplicated here so the prompt definition is self-contained.
 */
export interface RunGeniusIntent {
  location?: {
    origin?: { text: string };          // e.g., "my hotel", "Ferry Building"
    destination?: { text: string };    // e.g., "Union Square", or null for loop/area runs
    context?: string;                  // e.g., "inside Golden Gate Park", "near Hayes Valley"
    points_of_interest?: { text: string }[]; // Landmarks the user wants to pass
  };

  constraints?: {
    distance_km?: number;         // Target distance (km)
    duration_minutes?: number;    // Target duration (minutes)
    time_of_day?: string;         // Intended run time, e.g., "21:00", "07:00"
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
 * Core task: parse the user's intent.
 * @param userInput natural language string provided by the user
 * @returns Promise resolving to RunGeniusIntent or null on failure
 */
export async function parseUserIntent(userInput: string): Promise<RunGeniusIntent | null> {
  const languageModel = getLanguageModel();
  if (!languageModel || typeof languageModel.create !== 'function') {
    console.error("Global 'LanguageModel.create' function not found.");
    alert('AI create function (LanguageModel.create) not found.');
    return null;
  }

  // --- Enhanced system prompt definition ---
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
  // --- Prompt end ---

  try {
    // Create a Prompt API session
    const session = await languageModel.create({
      initialPrompts: [
        { role: 'system', content: systemPrompt }
      ],
      expectedInputs: [
        { type: 'text', languages: ['en', 'en'] }
      ],
      expectedOutputs: [
        { type: 'text', languages: ['en'] }
      ]
    });

    // Send the user input
    const result = await session.prompt(userInput);

    // Normalize and parse the raw JSON string
    const jsonResult = result.replace(/```json|```/g, '').trim();
    const parsedResult: RunGeniusIntent = JSON.parse(jsonResult);

    console.log('[AI] Parsed intent:', parsedResult);
    return parsedResult;

  } catch (error) {
    console.error('[AI] Error parsing user intent:', error);
    alert(`AI parsing failed. Please try rephrasing your request.\n\nError: ${error}`);
    return null;
  }
}