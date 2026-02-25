import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  dangerouslyAllowBrowser: true // Since we are calling from frontend as per guidelines
});

const tools: any[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all files in the entire project directory recursively.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List the contents of the current working directory (non-recursive).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the content of a specific file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The relative path to the file." }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a file with new content.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The relative path to the file." },
          content: { type: "string", description: "The content to write to the file." }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a specific file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The relative path to the file." }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cd",
      description: "Change the current working directory.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The path to navigate to (e.g., 'src', '..', '/')." }
        },
        required: ["path"]
      }
    }
  }
];

export const generateText = async (prompt: string) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0].message.content;
};

export const summarizeText = async (text: string) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: `Summarize the following text concisely:\n\n${text}` }],
  });
  return response.choices[0].message.content;
};

export const chatWithAI = async (message: string, projectContext?: string, history: any[] = []) => {
  const systemInstruction = `You are VibeTerm AI, a high-performance terminal assistant with agentic capabilities. 
  You can read, write, and delete files in the user's project.
  
  ${projectContext ? `Current Project Context (Files):\n${projectContext}` : ""}
  
  MEMORY MANAGEMENT:
  You maintain a file named 'ai.md' which acts as your long-term memory. 
  1. ALWAYS read 'ai.md' at the start of a task if it exists to understand your history.
  2. After completing a task successfully, you MUST update 'ai.md' with a brief summary of what you did, the date, and the outcome.
  3. If 'ai.md' does not exist, create it.
  4. Every new instance should start from new ai.md file.
  
  When the user asks you to perform a task, use the provided tools to execute the task.
  Always explain what you are doing. If you need to see a file's content before editing it, use read_file first.`;

  const messages: any[] = [
    { role: "system", content: systemInstruction },
    ...history,
    { role: "user", content: message }
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    tools,
    tool_choice: "auto"
  });

  return { response: response.choices[0].message, messages };
};

export const sendToolResponse = async (messages: any[], toolResults: any[]) => {
  const updatedMessages = [
    ...messages,
    ...toolResults
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: updatedMessages,
    tools,
    tool_choice: "auto"
  });

  return { response: response.choices[0].message, messages: updatedMessages };
};
