
import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse } from "../types";

const SYSTEM_PROMPT = `
You are the "AI Instruction Engine". Your job is to take raw, messy, or vernacular (Hinglish/Local) task descriptions from a manager and convert them into a structured, action-oriented checklist for field workers.

RULES:
1. Convert long sentences into short, 3-5 step checklists.
2. Use "Action-Oriented" language: start each step with a strong verb (e.g., Go, Bring, Call, Upload, Clean, Fix).
3. If the input is Hinglish or contains local slang, distill the core intent into professional yet simple instructions.
4. If a photo or proof is mentioned, ensure "Take/Upload photo" is a distinct step.
5. Provide a short, catchy title for the task.
`;

export const distillTask = async (rawInput: string): Promise<AIResponse> => {
  // Fix: Initialize GoogleGenAI with process.env.API_KEY directly.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: rawInput,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of actionable steps starting with verbs."
            },
            suggestedTitle: {
              type: Type.STRING,
              description: "A short 3-5 word title for the task."
            }
          },
          required: ["steps", "suggestedTitle"]
        }
      },
    });

    const result = JSON.parse(response.text || '{}');
    return {
      steps: result.steps || [],
      suggestedTitle: result.suggestedTitle || "New Task"
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};
