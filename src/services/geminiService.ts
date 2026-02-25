import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const listFilesTool: FunctionDeclaration = {
  name: "list_files",
  description: "List all files in the current project directory.",
  parameters: { type: Type.OBJECT, properties: {} }
};

const readFileTool: FunctionDeclaration = {
  name: "read_file",
  description: "Read the content of a specific file.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The relative path to the file." }
    },
    required: ["path"]
  }
};

const writeFileTool: FunctionDeclaration = {
  name: "write_file",
  description: "Create or overwrite a file with new content.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The relative path to the file." },
      content: { type: Type.STRING, description: "The content to write to the file." }
    },
    required: ["path", "content"]
  }
};

const deleteFileTool: FunctionDeclaration = {
  name: "delete_file",
  description: "Delete a specific file.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The relative path to the file." }
    },
    required: ["path"]
  }
};

export const generateText = async (prompt: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
  });
  return response.text;
};

export const summarizeText = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Summarize the following text concisely:\n\n${text}`,
  });
  return response.text;
};

export const chatWithAI = async (message: string, projectContext?: string, history: any[] = []) => {
  const chat = ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config: {
      systemInstruction: `You are VibeTerm AI, a high-performance terminal assistant with agentic capabilities. 
      You can read, write, and delete files in the user's project.
      
      ${projectContext ? `Current Project Context (Files):\n${projectContext}` : ""}
      
      When the user asks you to perform a task (e.g., "create a new component"), use the provided tools to execute the task.
      Always explain what you are doing. If you need to see a file's content before editing it, use read_file first.`,
      tools: [{ functionDeclarations: [listFilesTool, readFileTool, writeFileTool, deleteFileTool] }]
    },
    history: history
  });

  const response = await chat.sendMessage({ message });
  return { response, chat };
};

export const sendToolResponse = async (chat: any, toolResults: any[]) => {
  const response = await chat.sendMessage({
    message: {
      parts: toolResults
    }
  });
  return response;
};
