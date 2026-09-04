// MULTIVERS Backend Plugin for DeepSeek Harness (DSH)
// Features:
// 1. Session Context Synthesizer (Auto Digest of conversation, commands, and workspace state)
// 2. Flatline Context Window (Only 2-4 recent messages + Session Context Digest)
// 3. Antigravity-Grade Tool Result Pruner (Handles text strings & structured ContentBlock arrays)
// 4. Smart RPM Throttle & Anti-Burst Jitter Delay
// 5. Native 429 Adaptive Exponential Backoff Retry with Random Jitter
// 6. Native DSH Web Server routes for Settings Dashboard

import { promises as fsp } from "node:fs";
import fs from "node:fs";
import { dirname, join } from "node:path";
import os from "node:os";

export const name = "@aydin0411/dsh-multivers";
// Only inject llm and agents. webServer is resolved optionally at runtime.
export const inject = ["llm", "agents"];

const DEFAULTS = {
  enabled: true,
  enableSessionContextDigest: true,
  slidingWindowMessages: 4,
  truncateToolResults: true,
  maxToolResultChars: 1500,
  smartThrottleMs: 1200,
  flatlineDietEnabled: true,
  maxDigestLengthChars: 1200,
  maxRetries429: 4,
};

function getConfigFile() {
  const home = process.env.DSH_HOME || join(os.homedir(), ".dsh");
  return join(home, "multivers-config.json");
}

function loadConfig() {
  try {
    const p = getConfigFile();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf-8"));
      return { ...DEFAULTS, ...data };
    }
  } catch (err) {
    console.error("[MULTIVERS] Error loading config:", err);
  }
  return { ...DEFAULTS };
}

function saveConfig(cfg) {
  try {
    const p = getConfigFile();
    fs.mkdirSync(dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("[MULTIVERS] Error saving config:", err);
  }
  return false;
}

function extractTextFromContent(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(b => {
      if (!b) return "";
      if (typeof b === "string") return b;
      if (b.type === "text" && typeof b.text === "string") return b.text;
      if (b.type === "tool-result" && Array.isArray(b.content)) {
        return extractTextFromContent(b.content);
      }
      return "";
    }).filter(Boolean).join(" ");
  }
  return "";
}

function pruneContentBlocks(content, maxChars) {
  if (!content) return content;
  if (typeof content === "string") {
    if (content.length > maxChars) {
      const head = content.slice(0, Math.floor(maxChars * 0.7));
      const tail = content.slice(-Math.floor(maxChars * 0.3));
      return `${head}\n\n[... MULTIVERS Diet: Tool Output Pruned (${content.length - maxChars} chars hidden to prevent 429 rate limit) ...]\n\n${tail}`;
    }
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(block => {
      if (!block || typeof block !== "object") return block;
      if (block.type === "text" && typeof block.text === "string") {
        if (block.text.length > maxChars) {
          const head = block.text.slice(0, Math.floor(maxChars * 0.7));
          const tail = block.text.slice(-Math.floor(maxChars * 0.3));
          return {
            ...block,
            text: `${head}\n\n[... MULTIVERS Diet: Tool Output Pruned (${block.text.length - maxChars} chars hidden to prevent 429 rate limit) ...]\n\n${tail}`
          };
        }
      } else if (block.type === "tool-result") {
        return {
          ...block,
          content: pruneContentBlocks(block.content, maxChars)
        };
      }
      return block;
    });
  }

  return content;
}

function synthesizeSessionDigest(messages, maxChars = 1200) {
  if (!Array.isArray(messages) || messages.length === 0) return null;

  let userGoals = [];
  let executedCommands = [];
  let recentActions = [];

  for (const m of messages) {
    if (!m) continue;
    const text = extractTextFromContent(m.content);
    if (m.role === "user") {
      const trimmed = text.trim();
      if (trimmed.startsWith("/")) {
        executedCommands.push(trimmed.slice(0, 80));
      } else if (trimmed.length > 0) {
        userGoals.push(trimmed.slice(0, 120));
      }
    } else if (m.role === "assistant" || m.role === "tool") {
      if (text.includes("exit code:") || text.includes("HTTP") || text.includes("Created") || text.includes("Updated")) {
        recentActions.push(text.slice(0, 100));
      }
    }
  }

  const latestGoals = userGoals.slice(-3).map(g => `- ${g}`).join("\n");
  const latestCmds = executedCommands.slice(-4).map(c => `- ${c}`).join("\n");
  const latestActs = recentActions.slice(-3).map(a => `- ${a.replace(/\n+/g, " ")}`).join("\n");

  const digest = [
    "### 🪐 [MULTIVERS Session Context Digest]",
    latestGoals ? `**Intent / Topik User:**\n${latestGoals}` : null,
    latestCmds ? `**Perintah Terakhir:**\n${latestCmds}` : null,
    latestActs ? `**Aksi / State Terakhir:**\n${latestActs}` : null,
    "*(Konteks percakapan lampau telah dipadatkan oleh MULTIVERS Flatline Engine)*"
  ].filter(Boolean).join("\n\n");

  return digest.length > maxChars ? digest.slice(0, maxChars) + "..." : digest;
}

export function apply(ctx, config) {
  let activeConfig = loadConfig();
  let lastRequestTime = 0;

  // 1. Optional WebServer HTTP API registration (safe if webServer is absent)
  if (ctx.webServer) {
    ctx.webServer.register({
      kind: "exact",
      path: "/api/multivers/config",
      handler: async (req, res) => {
        const json = (status, payload) => {
          res.writeHead(status, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(payload));
        };
        if (req.method === "GET") {
          activeConfig = loadConfig();
          return json(200, { ok: true, config: activeConfig });
        }
        if (req.method === "POST") {
          try {
            const chunks = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            const merged = { ...activeConfig, ...body };
            saveConfig(merged);
            activeConfig = merged;
            return json(200, { ok: true, config: activeConfig });
          } catch (e) {
            return json(500, { ok: false, error: e.message });
          }
        }
        res.writeHead(405, { allow: "GET, POST" });
        res.end();
      }
    }, "dsh-multivers: config API");
  }

  // 2. Intercept LLM calls for Flatline Context & Anti-429 Antigravity Diet
  if (ctx.llm) {
    const originalStream = ctx.llm.stream?.bind(ctx.llm);
    if (originalStream) {
      ctx.llm.stream = async function (options) {
        if (!activeConfig.enabled) {
          return originalStream(options);
        }

        // Smart Throttle between rapid tool calls to avoid burst RPM limit
        if (activeConfig.smartThrottleMs > 0) {
          const now = Date.now();
          const elapsed = now - lastRequestTime;
          if (elapsed < activeConfig.smartThrottleMs) {
            const delay = activeConfig.smartThrottleMs - elapsed;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          lastRequestTime = Date.now();
        }

        const mutableOptions = { ...options };

        if (activeConfig.flatlineDietEnabled && Array.isArray(mutableOptions.messages)) {
          const allMsgs = [...mutableOptions.messages];
          const windowSize = Math.max(2, activeConfig.slidingWindowMessages || 4);

          let systemMsgs = [];
          let chatMsgs = [];

          for (const m of allMsgs) {
            if (m.role === "system") {
              systemMsgs.push(m);
            } else {
              chatMsgs.push({ ...m });
            }
          }

          let sessionDigestMsg = null;
          if (activeConfig.enableSessionContextDigest && chatMsgs.length > windowSize) {
            const olderHistory = chatMsgs.slice(0, -windowSize);
            const digestText = synthesizeSessionDigest(olderHistory, activeConfig.maxDigestLengthChars);
            if (digestText) {
              sessionDigestMsg = {
                role: "system",
                content: digestText
              };
            }
          }

          // Sliding window: only keep the most recent messages
          if (chatMsgs.length > windowSize) {
            chatMsgs = chatMsgs.slice(-windowSize);
          }

          // Antigravity-grade Tool Result Pruner
          if (activeConfig.truncateToolResults) {
            const maxChars = activeConfig.maxToolResultChars || 1500;
            for (let i = 0; i < chatMsgs.length; i++) {
              const m = chatMsgs[i];
              // Prune both older tool results and large assistant/user blocks
              if (m.role === "tool" || m.type === "tool_result" || m.source?.kind === "tool" || m.role === "user") {
                if (m.content) {
                  m.content = pruneContentBlocks(m.content, maxChars);
                }
              }
            }
          }

          mutableOptions.messages = [
            ...systemMsgs,
            ...(sessionDigestMsg ? [sessionDigestMsg] : []),
            ...chatMsgs
          ];
        }

        // Antigravity-grade Exponential Backoff Retry with Random Jitter for 429
        const maxRetries = activeConfig.maxRetries429 || 4;
        let attempt = 0;

        while (true) {
          try {
            return await originalStream(mutableOptions);
          } catch (err) {
            const errStr = (err?.message || err?.toString() || "") + (err?.failure?.message || "");
            const is429 = errStr.includes("429") || errStr.toLowerCase().includes("rate limit") || err?.failure?.code === "RATE_LIMIT";

            if (is429 && attempt < maxRetries) {
              attempt++;
              // Check provider retry-after or use exponential backoff + jitter
              let waitMs = err?.failure?.providerRetryAfterMs || Math.min(1000 * Math.pow(2, attempt), 25000);
              // Symmetric random jitter ±20%
              const jitter = 0.8 + 0.4 * Math.random();
              const delay = Math.round(waitMs * jitter);

              console.warn(`[MULTIVERS] ⚠️ Rate limit 429 detected on turn. Retrying in ${(delay / 1000).toFixed(1)}s (Attempt ${attempt}/${maxRetries})...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            throw err;
          }
        }
      };
    }
  }

  console.log("[MULTIVERS] Engine initialized successfully with Antigravity Payload Diet & Anti-429 Resilience.");
}
