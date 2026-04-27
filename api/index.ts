/**
 * Vercel Serverless Function 入口
 * 将所有 /api/* 请求代理到 Express app
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { v4 as uuidv4 } from "uuid";

// ---- 环境变量 ----
const USE_D1 = process.env.DATABASE_TYPE === "d1";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "qwen-plus";

// ---- 懒加载数据库模块 ----
let _db: typeof import("../server/db-d1.js") | typeof import("../server/db.js") | null = null;
async function getDb() {
  if (_db) return _db;
  if (USE_D1) {
    _db = await import("../server/db-d1.js");
    try { await (_db as any).initD1Schema(); } catch {}
  } else {
    _db = await import("../server/db.js");
  }
  return _db!;
}

// ---- 帮助函数 ----
function send(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

// ---- 系统提示词 ----
const defaultSystemPrompt = `你是「深观」应用的 AI 情感导师，专注于帮助用户深度观察和理解自己。
重要规则：你必须始终使用中文（简体中文）回复用户。
你的核心能力：情绪解读、自我洞察、成长陪伴、灵感激活。
对话风格：温暖、真诚、不评判，善于提问，引导用户自我探索。`;

// ---- 主处理函数 ----
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const db = await getDb();
  const url = req.url || "";
  const method = req.method || "GET";

  // 去掉 /api 前缀
  const path = url.replace(/^\/api/, "").split("?")[0];

  try {
    // ---- 健康检查 ----
    if (path === "/health" && method === "GET") {
      return send(res, 200, { status: "ok", timestamp: new Date().toISOString() });
    }

    // ---- 每日速记 ----
    if (path === "/daily-notes" && method === "GET") {
      return send(res, 200, { data: await db.getAllDailyNotes() });
    }
    if (path === "/daily-notes" && method === "POST") {
      let createdAt = new Date().toISOString();
      if (req.body?.date) {
        const d = new Date(req.body.date);
        if (!isNaN(d.getTime())) {
          d.setHours(new Date().getHours(), new Date().getMinutes(), new Date().getSeconds());
          createdAt = d.toISOString();
        }
      }
      const { date: _date, ...body } = req.body || {};
      const note = await db.createDailyNote({ id: uuidv4(), ...body, created_at: createdAt, updated_at: createdAt });
      if (note.inspiration) {
        await db.createGalaxyThought({ id: uuidv4(), content: note.inspiration, source: "daily_note", source_id: note.id, tags: "灵感", is_done: 0, created_at: new Date().toISOString() });
      }
      return send(res, 200, { data: note });
    }
    const dailyNoteMatch = path.match(/^\/daily-notes\/([^/]+)$/);
    if (dailyNoteMatch) {
      const id = dailyNoteMatch[1];
      if (method === "PUT") {
        await db.updateDailyNote(id, req.body || {});
        if ("inspiration" in (req.body || {})) {
          const d1 = db as any;
          if (d1.getDb) {
            // SQLite 同步方式
            d1.getDb().prepare("DELETE FROM galaxy_thoughts WHERE source = 'daily_note' AND source_id = ?").run(id);
          } else {
            await (db as typeof import("../server/db-d1.js")).deleteGalaxyThought && null;
          }
          if (req.body.inspiration?.trim()) {
            await db.createGalaxyThought({ id: uuidv4(), content: req.body.inspiration.trim(), source: "daily_note", source_id: id, tags: "灵感", is_done: 0, created_at: new Date().toISOString() });
          }
        }
        return send(res, 200, { success: true });
      }
      if (method === "DELETE") {
        await db.deleteDailyNote(id);
        return send(res, 200, { success: true });
      }
    }

    // ---- 情绪梳理 ----
    if (path === "/emotion-records" && method === "GET") {
      return send(res, 200, { data: await db.getAllEmotionRecords() });
    }
    if (path === "/emotion-records" && method === "POST") {
      const now = new Date().toISOString();
      const record = await db.createEmotionRecord({ id: uuidv4(), ...req.body, created_at: now, updated_at: now });
      return send(res, 200, { data: record });
    }
    const emotionMatch = path.match(/^\/emotion-records\/([^/]+)$/);
    if (emotionMatch) {
      const id = emotionMatch[1];
      if (method === "PUT") { await db.updateEmotionRecord(id, req.body || {}); return send(res, 200, { success: true }); }
      if (method === "DELETE") { await db.deleteEmotionRecord(id); return send(res, 200, { success: true }); }
    }

    // ---- 人生痛点 ----
    if (path === "/pain-points" && method === "GET") {
      return send(res, 200, { data: await db.getAllPainPoints() });
    }
    if (path === "/pain-points" && method === "POST") {
      const now = new Date().toISOString();
      const point = await db.createPainPoint({ id: uuidv4(), life_impact: 0, urgency: 1, priority: 0, ...req.body, created_at: now, updated_at: now });
      return send(res, 200, { data: point });
    }
    const painMatch = path.match(/^\/pain-points\/([^/]+)$/);
    if (painMatch) {
      const id = painMatch[1];
      if (method === "PUT") { await db.updatePainPoint(id, req.body || {}); return send(res, 200, { success: true }); }
      if (method === "DELETE") { await db.deletePainPoint(id); return send(res, 200, { success: true }); }
    }

    // ---- 打卡类型 ----
    if (path === "/checkin-types" && method === "GET") {
      return send(res, 200, { data: await db.getAllCheckinTypes() });
    }
    if (path === "/checkin-types" && method === "POST") {
      const t = await db.createCheckinType({ id: uuidv4(), color: "#4A90D9", ...req.body, created_at: new Date().toISOString() });
      return send(res, 200, { data: t });
    }
    const checkinTypeMatch = path.match(/^\/checkin-types\/([^/]+)$/);
    if (checkinTypeMatch) {
      const id = checkinTypeMatch[1];
      if (method === "PUT") { await db.updateCheckinType(id, req.body || {}); return send(res, 200, { success: true }); }
      if (method === "DELETE") { await db.deleteCheckinType(id); return send(res, 200, { success: true }); }
    }

    // ---- 打卡记录 ----
    if (path === "/checkin-records" && method === "GET") {
      const date = (req.query?.date as string) || new Date().toISOString().split("T")[0];
      return send(res, 200, { data: await db.getCheckinRecordsByDate(date) });
    }
    if (path === "/checkin-records/range" && method === "GET") {
      const { type_id, start, end } = req.query as { type_id: string; start: string; end: string };
      return send(res, 200, { data: await db.getCheckinRecordsByTypeAndDateRange(type_id, start, end) });
    }
    if (path === "/checkin-records/toggle" && method === "POST") {
      const { type_id, date } = req.body || {};
      const checked = await db.toggleCheckin(type_id, date || new Date().toISOString().split("T")[0]);
      return send(res, 200, { checked });
    }

    // ---- 思绪银河 ----
    if (path === "/galaxy-thoughts" && method === "GET") {
      return send(res, 200, { data: await db.getAllGalaxyThoughts() });
    }
    if (path === "/galaxy-thoughts" && method === "POST") {
      const t = await db.createGalaxyThought({ id: uuidv4(), is_done: 0, ...req.body, created_at: new Date().toISOString() });
      return send(res, 200, { data: t });
    }
    const galaxyToggleMatch = path.match(/^\/galaxy-thoughts\/([^/]+)\/toggle$/);
    if (galaxyToggleMatch && method === "POST") {
      await db.toggleGalaxyThoughtDone(galaxyToggleMatch[1]);
      return send(res, 200, { success: true });
    }
    const galaxyMatch = path.match(/^\/galaxy-thoughts\/([^/]+)$/);
    if (galaxyMatch && method === "DELETE") {
      await db.deleteGalaxyThought(galaxyMatch[1]);
      return send(res, 200, { success: true });
    }

    // ---- 统计 ----
    if (path === "/stats" && method === "GET") {
      return send(res, 200, await db.getStats());
    }
    if (path === "/weekly-report" && method === "GET") {
      return send(res, 200, { data: await db.getWeeklyReport() });
    }
    if (path === "/activity-calendar" && method === "GET") {
      const days = parseInt(req.query?.days as string) || 84;
      return send(res, 200, { data: await db.getActivityDates(days) });
    }

    // ---- AI 登录检查 / 模型列表 ----
    if (path === "/check-login" && method === "GET") {
      const apiKey = DEEPSEEK_API_KEY;
      return send(res, 200, { isLoggedIn: !!apiKey, envConfigured: !!apiKey, method: apiKey ? "env" : "none", apiKey: apiKey ? apiKey.slice(0, 8) + "****" + apiKey.slice(-4) : undefined });
    }
    if (path === "/models" && method === "GET") {
      return send(res, 200, {
        models: [
          { modelId: "qwen-plus", name: "通义千问 Plus", description: "阿里云通义千问，适合日常对话" },
          { modelId: "qwen-turbo", name: "通义千问 Turbo", description: "速度更快" },
          { modelId: "qwen-max", name: "通义千问 Max", description: "旗舰模型，效果最强" },
        ],
        defaultModel: DEEPSEEK_MODEL,
      });
    }

    // ---- 会话管理 ----
    if (path === "/sessions" && method === "GET") {
      const sessions = await db.getAllSessions();
      const withCount = await Promise.all(sessions.map(async s => ({
        ...s, messageCount: (await db.getMessagesBySession(s.id)).length
      })));
      return send(res, 200, { sessions: withCount });
    }
    if (path === "/sessions" && method === "POST") {
      const { model = DEEPSEEK_MODEL, title = "新对话" } = req.body || {};
      const now = new Date().toISOString();
      const session = await db.createSession({ id: uuidv4(), title, model, sdk_session_id: null, created_at: now, updated_at: now });
      return send(res, 200, { session });
    }
    const sessionMatch = path.match(/^\/sessions\/([^/]+)$/);
    if (sessionMatch) {
      const sid = sessionMatch[1];
      if (method === "GET") {
        const session = await db.getSession(sid);
        if (!session) return send(res, 404, { error: "会话不存在" });
        const messages = await db.getMessagesBySession(sid);
        return send(res, 200, { session, messages: messages.map(m => ({ ...m, tool_calls: m.tool_calls ? JSON.parse(m.tool_calls) : null })) });
      }
      if (method === "PATCH") {
        const { title, model } = req.body || {};
        const ok = await db.updateSession(sid, { title, model });
        if (!ok) return send(res, 404, { error: "会话不存在" });
        return send(res, 200, { success: true });
      }
      if (method === "DELETE") {
        const ok = await db.deleteSession(sid);
        if (!ok) return send(res, 404, { error: "会话不存在" });
        return send(res, 200, { success: true });
      }
    }

    // ---- 聊天（SSE 流式）----
    if (path === "/chat" && method === "POST") {
      const { sessionId, message, model, systemPrompt } = req.body || {};
      if (!message) return send(res, 400, { error: "消息不能为空" });
      if (!DEEPSEEK_API_KEY) return send(res, 500, { error: "未配置 DEEPSEEK_API_KEY" });

      let session = sessionId ? await db.getSession(sessionId) : null;
      const now = new Date().toISOString();
      if (!session) {
        session = await db.createSession({
          id: sessionId || uuidv4(),
          title: message.slice(0, 30) + (message.length > 30 ? "..." : ""),
          model: model || DEEPSEEK_MODEL, sdk_session_id: null, created_at: now, updated_at: now,
        });
      }

      const selectedModel = model || session.model || DEEPSEEK_MODEL;
      const userMsgId = uuidv4();
      const asstMsgId = uuidv4();

      await db.createMessage({ id: userMsgId, session_id: session.id, role: "user", content: message, model: null, created_at: now, tool_calls: null });

      // SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const write = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      write({ type: "init", sessionId: session.id, userMessageId: userMsgId, assistantMessageId: asstMsgId, model: selectedModel });

      const history = await db.getMessagesBySession(session.id);
      const msgs: Array<{ role: string; content: string }> = [
        { role: "system", content: systemPrompt || defaultSystemPrompt },
        ...history.filter(m => m.id !== userMsgId).map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ];

      const apiResp = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: selectedModel, messages: msgs, stream: true, temperature: 0.7, max_tokens: 2048 }),
      });

      if (!apiResp.ok) {
        write({ type: "error", message: `API 调用失败: ${apiResp.status}` });
        return res.end();
      }

      const reader = apiResp.body?.getReader();
      if (!reader) { write({ type: "error", message: "无法读取响应流" }); return res.end(); }

      const decoder = new TextDecoder();
      let fullResponse = "";
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t || !t.startsWith("data: ")) continue;
          const d = t.slice(6);
          if (d === "[DONE]") continue;
          try {
            const delta = JSON.parse(d).choices?.[0]?.delta?.content;
            if (delta) { fullResponse += delta; write({ type: "text", content: delta }); }
          } catch {}
        }
      }

      write({ type: "done" });
      if (fullResponse) {
        await db.createMessage({ id: asstMsgId, session_id: session.id, role: "assistant", content: fullResponse, model: selectedModel, created_at: new Date().toISOString(), tool_calls: null });
      }
      const allMsgs = await db.getMessagesBySession(session.id);
      if (allMsgs.length <= 2) {
        await db.updateSession(session.id, { title: message.slice(0, 30) + (message.length > 30 ? "..." : ""), model: selectedModel });
      }
      return res.end();
    }

    return send(res, 404, { error: "Not Found" });
  } catch (e: any) {
    console.error("[API] Error:", e?.message);
    return send(res, 500, { error: e?.message || "Internal Server Error" });
  }
}
