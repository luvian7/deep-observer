import express from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

// 数据库选择：DATABASE_TYPE=d1 时使用 Cloudflare D1，否则使用本地 SQLite
const USE_D1 = process.env.DATABASE_TYPE === "d1";
const db = USE_D1 ? await import("./db-d1.js") : await import("./db.js");

// D1 模式下启动时自动初始化表结构
if (USE_D1) {
  try { await db.initD1Schema(); } catch (e: any) { console.error("[D1] Schema init failed:", e.message); }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

// DeepSeek 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

// Middleware
app.use(express.json());

const defaultModel = DEEPSEEK_MODEL;

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============= 每日速记 API =============
app.get("/api/daily-notes", (req, res) => {
  try { res.json({ data: db.getAllDailyNotes() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/** 将灵感同步到银河（upsert：同一 source_id 不会重复） */
function syncInspirationToGalaxy(dailyNoteId: string, inspiration: string | undefined | null) {
  // 先清理旧的关联记录
  db.getDb().prepare("DELETE FROM galaxy_thoughts WHERE source = 'daily_note' AND source_id = ?").run(dailyNoteId);
  // 如果有新灵感，插入
  if (inspiration && inspiration.trim()) {
    db.createGalaxyThought({
      id: uuidv4(), content: inspiration.trim(),
      source: 'daily_note', source_id: dailyNoteId,
      tags: '灵感', is_done: 0, created_at: new Date().toISOString(),
    });
  }
}

app.post("/api/daily-notes", (req, res) => {
  try {
    // 支持补记：前端可传 date (YYYY-MM-DD) 作为 created_at
    let createdAt = new Date().toISOString();
    if (req.body.date) {
      const d = new Date(req.body.date);
      if (!isNaN(d.getTime())) {
        d.setHours(new Date().getHours(), new Date().getMinutes(), new Date().getSeconds());
        createdAt = d.toISOString();
      }
    }
    const { date: _date, ...body } = req.body;
    const note = db.createDailyNote({ id: uuidv4(), ...body, created_at: createdAt, updated_at: createdAt });
    if (note.inspiration) {
      db.createGalaxyThought({ id: uuidv4(), content: note.inspiration, source: 'daily_note', source_id: note.id, tags: '灵感', is_done: 0, created_at: new Date().toISOString() });
    }
    res.json({ data: note });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put("/api/daily-notes/:id", (req, res) => {
  try {
    db.updateDailyNote(req.params.id, req.body);
    // 编辑时同步灵感到银河
    if ('inspiration' in req.body) {
      syncInspirationToGalaxy(req.params.id, req.body.inspiration);
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/daily-notes/:id", (req, res) => {
  try {
    db.deleteDailyNote(req.params.id);
    // 删除速记时清理银河中对应的灵感
    db.getDb().prepare("DELETE FROM galaxy_thoughts WHERE source = 'daily_note' AND source_id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============= 情绪梳理 API =============
app.get("/api/emotion-records", (req, res) => {
  try { res.json({ data: db.getAllEmotionRecords() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/emotion-records", (req, res) => {
  try {
    const now = new Date().toISOString();
    const record = db.createEmotionRecord({ id: uuidv4(), ...req.body, created_at: now, updated_at: now });
    res.json({ data: record });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put("/api/emotion-records/:id", (req, res) => {
  try {
    db.updateEmotionRecord(req.params.id, req.body);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/emotion-records/:id", (req, res) => {
  try {
    db.deleteEmotionRecord(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============= 人生痛点 API =============
app.get("/api/pain-points", (req, res) => {
  try { res.json({ data: db.getAllPainPoints() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/pain-points", (req, res) => {
  try {
    const now = new Date().toISOString();
    const point = db.createPainPoint({ id: uuidv4(), life_impact: 0, urgency: 1, priority: 0, ...req.body, created_at: now, updated_at: now });
    res.json({ data: point });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put("/api/pain-points/:id", (req, res) => {
  try {
    db.updatePainPoint(req.params.id, req.body);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/pain-points/:id", (req, res) => {
  try {
    db.deletePainPoint(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============= 打卡类型 API =============
app.get("/api/checkin-types", (req, res) => {
  try { res.json({ data: db.getAllCheckinTypes() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/checkin-types", (req, res) => {
  try {
    const type = db.createCheckinType({ id: uuidv4(), color: '#4A90D9', ...req.body, created_at: new Date().toISOString() });
    res.json({ data: type });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put("/api/checkin-types/:id", (req, res) => {
  try {
    db.updateCheckinType(req.params.id, req.body);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/checkin-types/:id", (req, res) => {
  try {
    db.deleteCheckinType(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============= 打卡记录 API =============
app.get("/api/checkin-records", (req, res) => {
  try {
    const { date } = req.query as { date?: string };
    const today = date || new Date().toISOString().split('T')[0];
    res.json({ data: db.getCheckinRecordsByDate(today) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/checkin-records/range", (req, res) => {
  try {
    const { type_id, start, end } = req.query as { type_id: string; start: string; end: string };
    res.json({ data: db.getCheckinRecordsByTypeAndDateRange(type_id, start, end) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/checkin-records/toggle", (req, res) => {
  try {
    const { type_id, date } = req.body;
    const checked = db.toggleCheckin(type_id, date || new Date().toISOString().split('T')[0]);
    res.json({ checked });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============= 思绪银河 API =============
app.get("/api/galaxy-thoughts", (req, res) => {
  try { res.json({ data: db.getAllGalaxyThoughts() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/galaxy-thoughts", (req, res) => {
  try {
    const thought = db.createGalaxyThought({ id: uuidv4(), is_done: 0, ...req.body, created_at: new Date().toISOString() });
    res.json({ data: thought });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/galaxy-thoughts/:id/toggle", (req, res) => {
  try {
    db.toggleGalaxyThoughtDone(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/galaxy-thoughts/:id", (req, res) => {
  try {
    db.deleteGalaxyThought(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============= 统计 API =============
app.get("/api/stats", (req, res) => {
  try { res.json(db.getStats()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============= 本周报告 API =============
app.get("/api/weekly-report", (req, res) => {
  try { res.json({ data: db.getWeeklyReport() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============= 活跃日历 API（GitHub 贡献图风格） =============
app.get("/api/activity-calendar", (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 84;
    const activityDates = db.getActivityDates(days);
    res.json({ data: activityDates });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 检查 DeepSeek API Key 状态
app.get("/api/check-login", async (req, res) => {
  const apiKey = DEEPSEEK_API_KEY;
  res.json({
    isLoggedIn: !!apiKey,
    envConfigured: !!apiKey,
    method: apiKey ? 'env' : 'none',
    apiKey: apiKey ? apiKey.slice(0, 8) + '****' + apiKey.slice(-4) : undefined,
  });
});

// 获取可用模型列表（DeepSeek）
app.get("/api/models", async (req, res) => {
  res.json({
    models: [
      { modelId: "qwen-plus", name: "通义千问 Plus", description: "阿里云通义千问，适合日常对话" },
      { modelId: "qwen-turbo", name: "通义千问 Turbo", description: "阿里云通义千问，速度更快" },
      { modelId: "qwen-max", name: "通义千问 Max", description: "阿里云通义千问旗舰模型，效果最强" },
    ],
    defaultModel: DEEPSEEK_MODEL,
  });
});

// ============= 会话 API =============

// 获取所有会话（包含消息数量）
app.get("/api/sessions", (req, res) => {
  try {
    const sessions = db.getAllSessions();
    const sessionsWithMessages = sessions.map(session => {
      const messages = db.getMessagesBySession(session.id);
      return {
        ...session,
        messageCount: messages.length
      };
    });
    res.json({ sessions: sessionsWithMessages });
  } catch (error: any) {
    console.error("[Sessions] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 获取单个会话及其消息
app.get("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    const messages = db.getMessagesBySession(sessionId);
    
    // 解析 tool_calls JSON
    const parsedMessages = messages.map(msg => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
    }));
    
    res.json({ session, messages: parsedMessages });
  } catch (error: any) {
    console.error("[Session] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 创建新会话
app.post("/api/sessions", (req, res) => {
  try {
    const { model = defaultModel, title = "新对话" } = req.body;
    const now = new Date().toISOString();
    
    const session = db.createSession({
      id: uuidv4(),
      title,
      model,
      sdk_session_id: null,
      created_at: now,
      updated_at: now
    });
    
    res.json({ session });
  } catch (error: any) {
    console.error("[Create Session] Error:", error);
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

// 更新会话
app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model } = req.body;
    
    const success = db.updateSession(sessionId, { title, model });
    
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Update Session] Error:", error);
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

// 删除会话
app.delete("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = db.deleteSession(sessionId);
    
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Session] Error:", error);
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ============= 聊天 API =============

// 默认系统提示词
const defaultSystemPrompt = `你是「深观」应用的 AI 情感导师，专注于帮助用户深度观察和理解自己。

重要规则：
- 你必须始终使用中文（简体中文）回复用户，无论用户使用什么语言提问
- 如果用户用英文提问，你也必须用中文回答

你的核心能力：
1. **情绪解读**：帮助用户梳理情绪波动，找到触发点和模式
2. **自我洞察**：引导用户发现自己的行为习惯、思维模式和人生痛点
3. **成长陪伴**：鼓励用户记录每日小确幸，积累积极能量
4. **灵感激活**：帮助用户将灵感闪念转化为行动计划

对话风格：
- 温暖、真诚、不评判
- 善于提问，引导用户自我探索
- 给出具体可行的建议，而非空洞的安慰
- 适时引用用户记录的内容，体现对用户的了解

注意事项：
- AI 生成内容仅供参考，不构成专业心理建议
- 遇到严重心理健康问题，引导用户寻求专业帮助`;

// 发送消息并获取流式响应（DeepSeek API）
app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model, systemPrompt } = req.body;

  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}`);
  console.log(`[Chat] Model: ${model || DEEPSEEK_MODEL}`);
  console.log(`[Chat] Message: ${message?.slice(0, 100)}${message?.length > 100 ? '...' : ''}`);

  if (!message) {
    return res.status(400).json({ error: "消息不能为空" });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: "未配置 DEEPSEEK_API_KEY，请在 .env 文件中设置" });
  }

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();

  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
      model: model || DEEPSEEK_MODEL,
      sdk_session_id: null,
      created_at: now,
      updated_at: now
    });
  }

  const selectedModel = model || session.model || DEEPSEEK_MODEL;
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  // 保存用户消息到数据库
  try {
    db.createMessage({
      id: userMessageId,
      session_id: session.id,
      role: 'user',
      content: message,
      model: null,
      created_at: now,
      tool_calls: null
    });
  } catch (dbError: any) {
    return res.status(500).json({ error: "保存消息失败", detail: dbError?.message });
  }

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 发送 init 事件
  res.write(`data: ${JSON.stringify({
    type: "init",
    sessionId: session.id,
    userMessageId,
    assistantMessageId,
    model: selectedModel
  })}\n\n`);

  try {
    // 构建对话历史（从数据库加载该会话的所有历史消息）
    const historyMessages = db.getMessagesBySession(session.id);
    const messages: Array<{ role: string; content: string }> = [];

    // 添加系统提示词
    messages.push({ role: "system", content: systemPrompt || defaultSystemPrompt });

    // 添加历史消息（排除当前刚保存的用户消息，避免重复）
    for (const msg of historyMessages) {
      if (msg.id === userMessageId) continue; // 跳过刚保存的
      messages.push({ role: msg.role, content: msg.content });
    }

    // 添加当前用户消息
    messages.push({ role: "user", content: message });

    console.log(`[Chat] 调用 DeepSeek API，历史消息数: ${messages.length - 2}`);

    // 调用 DeepSeek API（OpenAI 兼容格式）
    const apiResponse = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`[Chat] DeepSeek API 错误: ${apiResponse.status}`, errorText);
      res.write(`data: ${JSON.stringify({ type: "error", message: `API 调用失败: ${apiResponse.status}` })}\n\n`);
      res.end();
      return;
    }

    // 读取 SSE 流
    const reader = apiResponse.body?.getReader();
    if (!reader) {
      res.write(`data: ${JSON.stringify({ type: "error", message: "无法读取 API 响应流" })}\n\n`);
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let fullResponse = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullResponse += delta;
            res.write(`data: ${JSON.stringify({ type: "text", content: delta })}\n\n`);
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    // 发送完成事件
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);

    // 保存助手消息到数据库
    if (fullResponse) {
      db.createMessage({
        id: assistantMessageId,
        session_id: session.id,
        role: "assistant",
        content: fullResponse,
        model: selectedModel,
        created_at: new Date().toISOString(),
        tool_calls: null
      });
    }

    // 更新会话标题（如果是前两条消息）
    const allMessages = db.getMessagesBySession(session.id);
    if (allMessages.length <= 2) {
      db.updateSession(session.id, {
        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        model: selectedModel
      });
    }

    console.log(`[Chat] 请求完成 ✓`);
    res.end();
  } catch (error: any) {
    console.error(`\n[Chat] ========== 错误 ==========`);
    console.error(`[Chat] Error:`, error?.message);
    console.error(`[Chat] Stack:`, error?.stack);

    const errorMessage = error?.message || "处理请求时发生错误";
    res.write(`data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`);
    res.end();
  }
});

// 生产模式：托管前端静态文件
if (isProduction) {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  // SPA fallback：所有非 API 路径都返回 index.html
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     ◉ API 服务器已启动                      ║
║                                            ║
║     地址: http://localhost:${PORT}            ║
║     数据库: SQLite (data/chat.db)          ║
║                                            ║
╚════════════════════════════════════════════╝
  `);
});
