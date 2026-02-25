/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Trash2, History, Info, ChevronRight, Cpu, Activity, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { generateText, summarizeText, chatWithAI, sendToolResponse } from './services/geminiService';

type LogEntry = {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: Date;
  command?: string;
};

export default function App() {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'welcome',
      type: 'system',
      content: 'VibeTerm AI [Version 1.1.0]\n(c) 2026 VibeCorp. All rights reserved.\n\nType "help" to see available commands.',
      timestamp: new Date(),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [cwd, setCwd] = useState('/');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      if (data.files) {
        setProjectFiles(data.files);
      }
    } catch (err) {
      console.error('Failed to fetch project files', err);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (type: LogEntry['type'], content: string, command?: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        type,
        content,
        timestamp: new Date(),
        command,
      },
    ]);
  };

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setHistory((prev) => [trimmed, ...prev].slice(0, 50));
    setHistoryIndex(-1);
    addLog('input', trimmed);
    setInput('');
    setIsProcessing(true);

    const [action, ...args] = trimmed.split(' ');
    const fullArgs = args.join(' ');

    try {
      switch (action.toLowerCase()) {
        case 'help':
          addLog('system', `
Available Commands:
  ls               - List current directory contents
  cd <path>        - Change current directory
  read <path>      - Read a specific file's content
  write <path> <content> - Create/overwrite a file
  delete <path>    - Delete a specific file
  gen <prompt>     - Generate text based on a prompt
  sum <text>       - Summarize the provided text
  chat <msg>       - Start an agentic session to perform tasks
  history          - Show command history
  clear            - Clear the terminal screen
  info             - System information
  exit             - Terminate session
          `);
          break;

        case 'write':
          const [pathArg, ...contentParts] = args;
          const contentArg = contentParts.join(' ');
          if (!pathArg || !contentArg) {
            addLog('error', 'Error: Path and content required. Usage: write <path> <content>');
          } else {
            const res = await fetch('/api/files/write', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: pathArg, content: contentArg })
            });
            const data = await res.json();
            if (data.error) {
              addLog('error', `Error: ${data.error}`);
            } else {
              addLog('system', data.message);
              await fetchFiles();
            }
          }
          break;

        case 'delete':
          if (!fullArgs) {
            addLog('error', 'Error: Path required. Usage: delete <path>');
          } else {
            const res = await fetch(`/api/files/delete?path=${encodeURIComponent(fullArgs)}`, {
              method: 'DELETE'
            });
            const data = await res.json();
            if (data.error) {
              addLog('error', `Error: ${data.error}`);
            } else {
              addLog('system', data.message);
              await fetchFiles();
            }
          }
          break;

        case 'ls':
          try {
            const res = await fetch('/api/files/ls');
            const data = await res.json();
            if (data.error) {
              addLog('error', `Error: ${data.error}`);
            } else {
              const items = data.contents.map((item: any) => 
                item.isDirectory ? `[DIR]  ${item.name}/` : `[FILE] ${item.name}`
              );
              addLog('system', `Directory: ${data.cwd}\n\n${items.join('\n')}`);
              setCwd(data.cwd);
            }
          } catch (err: any) {
            addLog('error', `Error: ${err.message}`);
          }
          break;

        case 'cd':
          if (!fullArgs) {
            addLog('error', 'Error: Path required. Usage: cd <path>');
          } else {
            const res = await fetch('/api/files/cd', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: fullArgs })
            });
            const data = await res.json();
            if (data.error) {
              addLog('error', `Error: ${data.error}`);
            } else {
              setCwd(data.cwd);
              addLog('system', `Changed directory to: ${data.cwd}`);
            }
          }
          break;

        case 'read':
          if (!fullArgs) {
            addLog('error', 'Error: Path required. Usage: read <path>');
          } else {
            const res = await fetch(`/api/files/content?path=${encodeURIComponent(fullArgs)}`);
            const data = await res.json();
            if (data.error) {
              addLog('error', `Error: ${data.error}`);
            } else {
              addLog('output', `\`\`\`${fullArgs.split('.').pop() || ''}\n${data.content}\n\`\`\``);
            }
          }
          break;

        case 'gen':
          if (!fullArgs) {
            addLog('error', 'Error: Prompt required. Usage: gen <prompt>');
          } else {
            const result = await generateText(fullArgs);
            addLog('output', result || 'No response generated.');
          }
          break;

        case 'sum':
          if (!fullArgs) {
            addLog('error', 'Error: Text required. Usage: sum <text>');
          } else {
            const result = await summarizeText(fullArgs);
            addLog('output', result || 'No summary generated.');
          }
          break;

        case 'chat':
          if (!fullArgs) {
            addLog('error', 'Error: Message required. Usage: chat <message>');
          } else {
            // Try to fetch memory from ai.md
            let memoryContext = "";
            try {
              const memRes = await fetch(`/api/files/content?path=ai.md`);
              const memData = await memRes.json();
              if (memData.content) {
                memoryContext = `\nLONG-TERM MEMORY (ai.md):\n${memData.content}\n`;
              }
            } catch (e) {
              // ai.md might not exist yet, that's fine
            }

            const context = projectFiles.length > 0 ? projectFiles.join(', ') : undefined;
            const fullContext = `CURRENT DIRECTORY: ${cwd}\n` + (context || "") + memoryContext;
            
            let { response, chat } = await chatWithAI(fullArgs, fullContext);
            
            // Agentic Loop
            let iterations = 0;
            const MAX_ITERATIONS = 10;

            while (response.functionCalls && iterations < MAX_ITERATIONS) {
              iterations++;
              const toolResults: any[] = [];

              for (const call of response.functionCalls) {
                addLog('system', `Agent executing: ${call.name}(${JSON.stringify(call.args)})`);
                
                let result;
                try {
                  switch (call.name) {
                    case 'list_files':
                      const lsAllRes = await fetch('/api/files');
                      result = await lsAllRes.json();
                      if (result.files) setProjectFiles(result.files);
                      break;
                    case 'list_dir':
                      const lsDirRes = await fetch('/api/files/ls');
                      result = await lsDirRes.json();
                      break;
                    case 'read_file':
                      const readRes = await fetch(`/api/files/content?path=${encodeURIComponent(call.args.path as string)}`);
                      result = await readRes.json();
                      break;
                    case 'write_file':
                      const writeRes = await fetch('/api/files/write', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: call.args.path, content: call.args.content })
                      });
                      result = await writeRes.json();
                      await fetchFiles(); // Refresh file list
                      break;
                    case 'delete_file':
                      const delRes = await fetch(`/api/files/delete?path=${encodeURIComponent(call.args.path as string)}`, {
                        method: 'DELETE'
                      });
                      result = await delRes.json();
                      await fetchFiles(); // Refresh file list
                      break;
                    case 'cd':
                      const cdRes = await fetch('/api/files/cd', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: call.args.path })
                      });
                      result = await cdRes.json();
                      if (result.cwd) setCwd(result.cwd);
                      break;
                    default:
                      result = { error: `Unknown tool: ${call.name}` };
                  }
                } catch (err: any) {
                  result = { error: err.message };
                }
                
                toolResults.push({
                  functionResponse: {
                    name: call.name,
                    response: result
                  }
                });
              }

              // Send tool results back to the model
              response = await sendToolResponse(chat, toolResults);
            }

            addLog('output', response.text || 'Task completed.');
          }
          break;

        case 'history':
          addLog('system', history.length > 0 
            ? history.map((h, i) => `${history.length - i}. ${h}`).reverse().join('\n')
            : 'No history found.'
          );
          break;

        case 'clear':
          setLogs([{
            id: 'welcome-clear',
            type: 'system',
            content: 'Terminal cleared. Type "help" for commands.',
            timestamp: new Date(),
          }]);
          break;

        case 'info':
          addLog('system', `
System Status:
  Kernel: VibeOS 2.1.0-stable
  AI Engine: Gemini 3.1 Pro
  Latency: Optimized
  Security: Encrypted
  Environment: AI Studio Sandbox
          `);
          break;

        case 'exit':
          addLog('system', 'Session terminated. Goodbye.');
          setTimeout(() => window.location.reload(), 1000);
          break;

        default:
          addLog('error', `Unknown command: "${action}". Type "help" for a list of commands.`);
      }
    } catch (error: any) {
      addLog('error', `Critical Error: ${error.message || 'Unknown API error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  return (
    <div className="min-h-screen bg-terminal-bg p-4 md:p-8 flex flex-col items-center justify-center font-mono selection:bg-terminal-accent/30 selection:text-terminal-accent">
      {/* Hardware Frame */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl h-[80vh] bg-terminal-card rounded-xl border border-terminal-muted/20 shadow-2xl flex flex-col overflow-hidden relative"
      >
        {/* Header / Status Bar */}
        <div className="h-12 bg-black/40 border-b border-terminal-muted/10 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
            <div className="h-4 w-px bg-terminal-muted/20 mx-2" />
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-terminal-muted font-bold">
              <Terminal size={12} className="text-terminal-accent" />
              <span>VibeTerm v1.0.42</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-[10px] text-terminal-muted font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <Cpu size={12} />
              <span>98% CPU</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={12} />
              <span>4ms LAT</span>
            </div>
            <div className="flex items-center gap-1.5 text-terminal-accent">
              <ShieldCheck size={12} />
              <span>SECURE</span>
            </div>
          </div>
        </div>

        {/* Terminal Output Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 terminal-scroll space-y-4"
        >
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex flex-col gap-1 ${
                  log.type === 'input' ? 'text-terminal-accent' : 
                  log.type === 'error' ? 'text-red-400' : 
                  log.type === 'system' ? 'text-terminal-muted italic' : 
                  'text-terminal-text'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-1 opacity-50">
                    {log.type === 'input' ? <ChevronRight size={14} /> : 
                     log.type === 'output' ? <div className="w-1.5 h-1.5 rounded-full bg-terminal-accent mt-1.5" /> : null}
                  </span>
                  <div className="flex-1">
                    {log.type === 'output' ? (
                      <div className="markdown-body">
                        <Markdown>{log.content}</Markdown>
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
                        {log.content}
                      </pre>
                    )}
                  </div>
                </div>
                <div className="text-[9px] opacity-30 self-end">
                  {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-terminal-accent text-sm"
            >
              <div className="w-2 h-2 bg-terminal-accent rounded-full animate-pulse" />
              <span className="animate-pulse">AI is thinking...</span>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-black/20 border-t border-terminal-muted/10 shrink-0">
          <div className="relative flex items-center gap-3">
            <span className="text-terminal-accent font-bold shrink-0">
              {cwd} $
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
              autoFocus
              placeholder={isProcessing ? "Processing command..." : "Enter command (e.g. gen, sum, chat)..."}
              className="flex-1 bg-transparent border-none outline-none text-terminal-text font-mono text-sm placeholder:text-terminal-muted/30"
            />
            {input && !isProcessing && (
              <button 
                onClick={() => handleCommand(input)}
                className="p-2 hover:bg-terminal-accent/10 rounded-lg text-terminal-accent transition-colors cursor-pointer"
              >
                <Send size={16} />
              </button>
            )}
            <div className="absolute right-0 bottom-[-1.5rem] flex gap-4 text-[9px] text-terminal-muted/40 uppercase font-bold tracking-tighter">
              <span>[ENTER] EXECUTE</span>
              <span>[UP/DOWN] HISTORY</span>
              <span>[TAB] AUTOCOMPLETE</span>
            </div>
          </div>
        </div>

        {/* Decorative Grid Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(0,255,65,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />
      </motion.div>

      {/* Footer Info */}
      <div className="mt-6 flex gap-8 text-[10px] text-terminal-muted/60 uppercase tracking-widest font-bold">
        <div className="flex items-center gap-2">
          <Info size={12} />
          <span>VibeTerm AI v1.0.42</span>
        </div>
        <div className="flex items-center gap-2">
          <History size={12} />
          <span>Session: {logs.length} entries</span>
        </div>
        <div className="flex items-center gap-2">
          <Trash2 size={12} />
          <span>Auto-purge enabled</span>
        </div>
      </div>
    </div>
  );
}
