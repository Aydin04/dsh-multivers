// MULTIVERS Backend Plugin for DeepSeek Harness (DSH)
// Features:
// 1. Session Context Synthesizer (Auto Digest of conversation, commands, and workspace state)
// 2. Flatline Context Window (Only 2-4 recent messages + Session Context Digest)
// 3. Tool Result Pruner (Prunes large bash/PTC logs)
// 4. Smart RPM Throttle (Anti-429 Rate Limit)
// 5. REST API for MULTIVERS Settings Dashboard

import { promises as fsp } from "node:fs";
import fs from "node:fs";
import { dirname, join } from "node:path";
import os from "node:os";

export const name = "@aydin04/dsh-multivers";
export const inject = ["llm", "agents", "server"];

const DEFAULTS = {
  enabled: true,
  enableSessionContextDigest: true, // Auto generate dynamic session context (messages, commands, session state)
  slidingWindowMessages: 4, // Number of raw recent messages to keep
  truncateToolResults: true,
  maxToolResultChars: 1500, // Prune bloated tool results
  smartThrottleMs: 1200, // Minimal delay between requests (ms)
  flatlineDietEnabled: true,
  maxDigestLengthChars: 1200,
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
    return false;
  }
}

// Extract concise session digest from history (messages, commands, tool actions)
function synthesizeSessionDigest(messages, maxChars = 1200) {
  if (!Array.isArray(messages) || messages.length === 0) return null;

  let userGoals = [];
  let executedCommands = [];
  let recentActions = [];

  for (const m of messages) {
    if (!m) continue;
    const text = typeof m.content === "string" ? m.content : (Array.isArray(m.content) ? m.content.map(c => c.text || "").join(" ") : "");
    
    // Catch user requests/commands
    if (m.role === "user") {
      const trimmed = text.trim();
      if (trimmed.startsWith("/")) {
        executedCommands.push(trimmed.slice(0, 80));
      } else if (trimmed.length > 0) {
        userGoals.push(trimmed.slice(0, 120));
      }
    } else if (m.role === "assistant" || m.role === "tool") {
      // Extract tool call summaries
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

  // 1. REST API endpoints for Settings Dashboard
  if (ctx.server) {
    ctx.server.get("/api/multivers/config", async (c) => {
      activeConfig = loadConfig();
      return c.json({ ok: true, config: activeConfig });
    });

    ctx.server.post("/api/multivers/config", async (c) => {
      try {
        const body = await c.req.json();
        const merged = { ...activeConfig, ...body };
        saveConfig(merged);
        activeConfig = merged;
        return c.json({ ok: true, config: activeConfig });
      } catch (e) {
        return c.json({ ok: false, error: e.message }, 500);
      }
    });

    ctx.server.get("/api/multivers/stats", async (c) => {
      return c.json({
        ok: true,
        stats: {
          uptime: process.uptime(),
          sessionDigestEnabled: activeConfig.enableSessionContextDigest,
          slidingWindowMessages: activeConfig.slidingWindowMessages,
          dietEnabled: activeConfig.flatlineDietEnabled,
          truncateEnabled: activeConfig.truncateToolResults,
        }
      });
    });
  }

  // 2. LLM Stream Interceptor (Flatline Context + Session Digest + Tool Pruning)
  if (ctx.llm) {
    const originalStream = ctx.llm.stream?.bind(ctx.llm);
    if (originalStream) {
      ctx.llm.stream = async function (options) {
        if (!activeConfig.enabled) {
          return originalStream(options);
        }

        // Anti-429 Smart Throttle
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
              chatMsgs.push(m);
            }
          }

          // Build dynamic Session Context Digest from older messages before slicing
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

          // Keep only the recent active chat messages
          if (chatMsgs.length > windowSize) {
            chatMsgs = chatMsgs.slice(-windowSize);
          }

          // Prune bloated tool results
          if (activeConfig.truncateToolResults) {
            const maxChars = activeConfig.maxToolResultChars || 1500;
            for (const m of chatMsgs) {
              if (m.role === "tool" || m.type === "tool_result" || (m.content && typeof m.content === "string")) {
                if (typeof m.content === "string" && m.content.length > maxChars) {
                  const head = m.content.slice(0, Math.floor(maxChars * 0.7));
                  const tail = m.content.slice(-Math.floor(maxChars * 0.3));
                  m.content = `${head}\n\n[... MULTIVERS Diet: Tool Output Pruned (${m.content.length - maxChars} chars hidden to prevent 429 limit) ...]\n\n${tail}`;
                }
              }
            }
          }

          // Assemble final lean payload: [System, (MULTIVERS Digest), Recent Chat Messages]
          mutableOptions.messages = [
            ...systemMsgs,
            ...(sessionDigestMsg ? [sessionDigestMsg] : []),
            ...chatMsgs
          ];
        }

        return originalStream(mutableOptions);
      };
    }
  }

  console.log("[MULTIVERS] Session Context & Zero-Bloat Engine Active.");
}