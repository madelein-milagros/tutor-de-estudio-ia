import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `Eres un tutor de estudio experto, paciente y didáctico. Tu trabajo es ayudar al usuario a entender y memorizar el contenido del documento proporcionado.

Reglas de comportamiento:
1. Responde siempre en español, con un tono amigable y motivador.
2. Si no encuentras la respuesta en el documento, dilo claramente: "No encontré esa información en el material proporcionado".
3. Cuando explique conceptos, usa ejemplos prácticos, analogías o comparaciones sencillas.
4. Para preguntas de estudio, ofrece respuestas estructuradas con viñetas o pasos numerados.
5. Si te piden un quiz, genera preguntas de opción múltiple con la respuesta correcta y una breve explicación.

Formatos específicos:
- "Resume este capítulo en 5 puntos clave": Proporciona un resumen conciso.
- "Explícame como si tuviera 10 años": Simplifica conceptos complejos.
- "Crea un quiz de 5 preguntas": Genera preguntas de práctica.
- "Genera una tabla comparativa": Estructura diferencias y similitudes.

Contexto del documento:
{documentContext}
`;

export class StudyTutorService {
  private ai: GoogleGenAI;
  private model: string = "gemini-3-flash-preview";

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async chat(message: string, documentContext: string, history: { role: "user" | "model"; parts: { text: string }[] }[]) {
    // Truncate document context to ~800k tokens (approx 3MB of text) to leave room for history and response
    const MAX_DOC_LENGTH = 3000000; 
    const truncatedContext = documentContext.length > MAX_DOC_LENGTH 
      ? documentContext.substring(0, MAX_DOC_LENGTH) + "... [Documento truncado por longitud]"
      : documentContext;

    // Limit history to last 20 messages to keep context window healthy
    const limitedHistory = history.slice(-20);

    const chat = this.ai.chats.create({
      model: this.model,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION.replace("{documentContext}", truncatedContext || "No hay documento cargado aún."),
      },
      history: limitedHistory,
    });

    const result = await chat.sendMessage({ message });
    return result.text;
  }

  async generateQuiz(documentContext: string) {
    const prompt = "Crea un quiz de 5 preguntas de opción múltiple sobre el contenido del documento. Devuelve la respuesta en formato JSON.";
    const result = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION.replace("{documentContext}", documentContext),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });
    return JSON.parse(result.text || "[]");
  }
}
