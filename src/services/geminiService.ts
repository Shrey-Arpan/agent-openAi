import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const listFilesTool: FunctionDeclaration = {
  name: "list_files",
  description: "List all files in the entire project directory recursively.",
  parameters: { type: Type.OBJECT, properties: {} }
};

const listDirTool: FunctionDeclaration = {
  name: "list_dir",
  description: "List the contents of the current working directory (non-recursive).",
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

const cdTool: FunctionDeclaration = {
  name: "cd",
  description: "Change the current working directory.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The path to navigate to (e.g., 'src', '..', '/')." }
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
      
      MEMORY MANAGEMENT:
      You maintain a file named 'ai.md' which acts as your long-term memory. 
      1. ALWAYS read 'ai.md' at the start of a task if it exists to understand your history.
      2. After completing a task successfully, you MUST update 'ai.md' with a brief summary of what you did, the date, and the outcome.
      3. If 'ai.md' does not exist, create it.
      
      When the user asks you to perform a task, use the provided tools to execute the task.
      Always explain what you are doing. If you need to see a file's content before editing it, use read_file first.`,
      tools: [{ functionDeclarations: [listFilesTool, listDirTool, readFileTool, writeFileTool, deleteFileTool, cdTool] }]
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
