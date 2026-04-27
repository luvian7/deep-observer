/**
 * Cloudflare D1 远程数据库层
 * 通过 REST API 操作 D1，接口与 db.ts（better-sqlite3 版）完全一致
 * 
 * 环境变量：
 *   CLOUDFLARE_ACCOUNT_ID - Cloudflare 账号 ID
 *   CLOUDFLARE_DATABASE_ID - D1 数据库 ID
 *   CLOUDFLARE_D1_TOKEN - Cloudflare API Token（需 D1 编辑权限）
 */

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_D1_TOKEN || '';

const D1_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}/query`;

/** 执行 D1 HTTP 查询 */
async function d1Query(sql: string, params: any[] = []): Promise<any[]> {
  const res = await fetch(D1_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });
  const json = await res.json();
  if (!json.success) {
    console.error('[D1] Error:', json.errors);
    throw new Error(`D1 query failed: ${JSON.stringify(json.errors)}`);
  }
  return json.result?.[0]?.results || [];
}

/** 执行多条 D1 语句（建表用） */
export async function d1Exec(sql: string): Promise<void> {
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  const res = await fetch(D1_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: statements[0], params: [] }),
  });
  const json = await res.json();
  if (!json.success) {
    console.error('[D1] Exec error:', json.errors);
    throw new Error(`D1 exec failed: ${JSON.stringify(json.errors)}`);
  }
}

// ============= 初始化表结构 =============
export async function initD1Schema() {
  const tables = await d1Query("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = new Set(tables.map((t: any) => t.name));
  
  if (tableNames.has('daily_notes')) return; // 已初始化

  const schema = `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      sdk_session_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT,
      created_at TEXT NOT NULL,
      tool_calls TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE TABLE IF NOT EXISTS daily_notes (
      id TEXT PRIMARY KEY,
      small_joy TEXT,
      small_gain TEXT,
      inspiration TEXT,
      mood TEXT,
      mood_emoji TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS emotion_records (
      id TEXT PRIMARY KEY,
      trigger_event TEXT,
      my_feeling TEXT,
      discovery TEXT,
      next_action TEXT,
      mood_emoji TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pain_points (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT,
      my_feeling TEXT,
      life_impact INTEGER DEFAULT 0,
      urgency INTEGER DEFAULT 1,
      change_plan TEXT,
      priority INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checkin_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      target TEXT,
      color TEXT DEFAULT '#4A90D9',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checkin_records (
      id TEXT PRIMARY KEY,
      type_id TEXT NOT NULL,
      checked INTEGER DEFAULT 0,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (type_id) REFERENCES checkin_types(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_checkin_records_date ON checkin_records(date);
    CREATE INDEX IF NOT EXISTS idx_checkin_records_type_id ON checkin_records(type_id);
    CREATE TABLE IF NOT EXISTS galaxy_thoughts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT,
      source_id TEXT,
      tags TEXT,
      is_done INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `;

  for (const stmt of schema.split(';').map(s => s.trim()).filter(s => s)) {
    await d1Exec(stmt);
  }
  console.log('[D1] Schema initialized');
}

// ============= 类型定义（与 db.ts 一致） =============
export interface DbSession { id: string; title: string; model: string; sdk_session_id: string | null; created_at: string; updated_at: string; }
export interface DbMessage { id: string; session_id: string; role: 'user' | 'assistant'; content: string; model: string | null; created_at: string; tool_calls: string | null; }
export interface DailyNote { id: string; small_joy?: string; small_gain?: string; inspiration?: string; mood?: string; mood_emoji?: string; created_at: string; updated_at: string; }
export interface EmotionRecord { id: string; trigger_event?: string; my_feeling?: string; discovery?: string; next_action?: string; mood_emoji?: string; created_at: string; updated_at: string; }
export interface PainPoint { id: string; title: string; type?: string; my_feeling?: string; life_impact: number; urgency: number; change_plan?: string; priority: number; created_at: string; updated_at: string; }
export interface CheckinType { id: string; name: string; icon?: string; target?: string; color: string; created_at: string; }
export interface CheckinRecord { id: string; type_id: string; checked: number; date: string; created_at: string; }
export interface GalaxyThought { id: string; content: string; source?: string; source_id?: string; tags?: string; is_done: number; created_at: string; }

// ============= 会话操作 =============
export async function getAllSessions(): Promise<DbSession[]> { return d1Query('SELECT * FROM sessions ORDER BY updated_at DESC'); }
export async function getSession(id: string): Promise<DbSession | undefined> { const r = await d1Query('SELECT * FROM sessions WHERE id = ?', [id]); return r[0]; }
export async function createSession(s: DbSession): Promise<DbSession> { await d1Query(`INSERT INTO sessions (id, title, model, sdk_session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [s.id, s.title, s.model, s.sdk_session_id, s.created_at, s.updated_at]); return s; }
export async function updateSession(id: string, updates: Partial<Pick<DbSession, 'title' | 'model' | 'sdk_session_id'>>): Promise<boolean> {
  const fields: string[] = []; const values: any[] = [];
  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.model !== undefined) { fields.push('model = ?'); values.push(updates.model); }
  if (updates.sdk_session_id !== undefined) { fields.push('sdk_session_id = ?'); values.push(updates.sdk_session_id); }
  if (fields.length === 0) return false;
  fields.push('updated_at = ?'); values.push(new Date().toISOString()); values.push(id);
  const r = await d1Query(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`, values);
  return (r as any).meta?.changes > 0;
}
export async function deleteSession(id: string): Promise<boolean> { const r = await d1Query('DELETE FROM sessions WHERE id = ?', [id]); return (r as any).meta?.changes > 0; }

// ============= 消息操作 =============
export async function getMessagesBySession(sessionId: string): Promise<DbMessage[]> { return d1Query('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC', [sessionId]); }
export async function createMessage(m: DbMessage): Promise<DbMessage> {
  await d1Query(`INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls) VALUES (?, ?, ?, ?, ?, ?, ?)`, [m.id, m.session_id, m.role, m.content, m.model, m.created_at, m.tool_calls]);
  await d1Query('UPDATE sessions SET updated_at = ? WHERE id = ?', [new Date().toISOString(), m.session_id]);
  return m;
}
export async function updateMessage(id: string, updates: Partial<Pick<DbMessage, 'content' | 'tool_calls'>>): Promise<boolean> {
  const fields: string[] = []; const values: any[] = [];
  if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
  if (updates.tool_calls !== undefined) { fields.push('tool_calls = ?'); values.push(updates.tool_calls); }
  if (fields.length === 0) return false;
  values.push(id);
  const r = await d1Query(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`, values);
  return (r as any).meta?.changes > 0;
}
export async function deleteMessage(id: string): Promise<boolean> { const r = await d1Query('DELETE FROM messages WHERE id = ?', [id]); return (r as any).meta?.changes > 0; }

// ============= 每日速记 =============
export async function getAllDailyNotes(): Promise<DailyNote[]> { return d1Query('SELECT * FROM daily_notes ORDER BY created_at DESC'); }
export async function createDailyNote(n: DailyNote): Promise<DailyNote> {
  await d1Query(`INSERT INTO daily_notes (id, small_joy, small_gain, inspiration, mood, mood_emoji, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [n.id, n.small_joy, n.small_gain, n.inspiration, n.mood, n.mood_emoji, n.created_at, n.updated_at]);
  return n;
}
export async function updateDailyNote(id: string, updates: Partial<Omit<DailyNote, 'id' | 'created_at'>>): Promise<boolean> {
  const fields: string[] = []; const values: any[] = [];
  for (const col of ['small_joy', 'small_gain', 'inspiration', 'mood', 'mood_emoji'] as const) {
    if (updates[col] !== undefined) { fields.push(`${col} = ?`); values.push(updates[col]); }
  }
  if (fields.length === 0) return false;
  fields.push('updated_at = ?'); values.push(new Date().toISOString()); values.push(id);
  const r = await d1Query(`UPDATE daily_notes SET ${fields.join(', ')} WHERE id = ?`, values);
  return (r as any).meta?.changes > 0;
}
export async function deleteDailyNote(id: string): Promise<boolean> { const r = await d1Query('DELETE FROM daily_notes WHERE id = ?', [id]); return (r as any).meta?.changes > 0; }

// ============= 情绪梳理 =============
export async function getAllEmotionRecords(): Promise<EmotionRecord[]> { return d1Query('SELECT * FROM emotion_records ORDER BY created_at DESC'); }
export async function createEmotionRecord(r: EmotionRecord): Promise<EmotionRecord> {
  await d1Query(`INSERT INTO emotion_records (id, trigger_event, my_feeling, discovery, next_action, mood_emoji, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [r.id, r.trigger_event, r.my_feeling, r.discovery, r.next_action, r.mood_emoji, r.created_at, r.updated_at]);
  return r;
}
export async function updateEmotionRecord(id: string, updates: Partial<Omit<EmotionRecord, 'id' | 'created_at'>>): Promise<boolean> {
  const fields: string[] = []; const values: any[] = [];
  for (const col of ['trigger_event', 'my_feeling', 'discovery', 'next_action', 'mood_emoji'] as const) {
    if (updates[col] !== undefined) { fields.push(`${col} = ?`); values.push(updates[col]); }
  }
  if (fields.length === 0) return false;
  fields.push('updated_at = ?'); values.push(new Date().toISOString()); values.push(id);
  const r = await d1Query(`UPDATE emotion_records SET ${fields.join(', ')} WHERE id = ?`, values);
  return (r as any).meta?.changes > 0;
}
export async function deleteEmotionRecord(id: string): Promise<boolean> { const r = await d1Query('DELETE FROM emotion_records WHERE id = ?', [id]); return (r as any).meta?.changes > 0; }

// ============= 人生痛点 =============
export async function getAllPainPoints(): Promise<PainPoint[]> { return d1Query('SELECT * FROM pain_points ORDER BY priority ASC, life_impact DESC'); }
export async function createPainPoint(p: PainPoint): Promise<PainPoint> {
  await d1Query(`INSERT INTO pain_points (id, title, type, my_feeling, life_impact, urgency, change_plan, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [p.id, p.title, p.type, p.my_feeling, p.life_impact, p.urgency, p.change_plan, p.priority, p.created_at, p.updated_at]);
  return p;
}
export async function updatePainPoint(id: string, updates: Partial<Omit<PainPoint, 'id' | 'created_at'>>): Promise<boolean> {
  const fields: string[] = []; const values: any[] = [];
  for (const col of ['title', 'type', 'my_feeling', 'life_impact', 'urgency', 'change_plan', 'priority'] as const) {
    if (updates[col] !== undefined) { fields.push(`${col} = ?`); values.push(updates[col]); }
  }
  if (fields.length === 0) return false;
  fields.push('updated_at = ?'); values.push(new Date().toISOString()); values.push(id);
  const r = await d1Query(`UPDATE pain_points SET ${fields.join(', ')} WHERE id = ?`, values);
  return (r as any).meta?.changes > 0;
}
export async function deletePainPoint(id: string): Promise<boolean> { const r = await d1Query('DELETE FROM pain_points WHERE id = ?', [id]); return (r as any).meta?.changes > 0; }

// ============= 打卡类型 =============
export async function getAllCheckinTypes(): Promise<CheckinType[]> { return d1Query('SELECT * FROM checkin_types ORDER BY created_at ASC'); }
export async function createCheckinType(t: CheckinType): Promise<CheckinType> {
  await d1Query(`INSERT INTO checkin_types (id, name, icon, target, color, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [t.id, t.name, t.icon, t.target, t.color, t.created_at]);
  return t;
}
export async function updateCheckinType(id: string, updates: Partial<Omit<CheckinType, 'id' | 'created_at'>>): Promise<boolean> {
  const fields: string[] = []; const values: any[] = [];
  for (const col of ['name', 'icon', 'target', 'color'] as const) {
    if (updates[col] !== undefined) { fields.push(`${col} = ?`); values.push(updates[col]); }
  }
  if (fields.length === 0) return false;
  values.push(id);
  const r = await d1Query(`UPDATE checkin_types SET ${fields.join(', ')} WHERE id = ?`, values);
  return (r as any).meta?.changes > 0;
}
export async function deleteCheckinType(id: string): Promise<boolean> { const r = await d1Query('DELETE FROM checkin_types WHERE id = ?', [id]); return (r as any).meta?.changes > 0; }

// ============= 打卡记录 =============
export async function getCheckinRecordsByDate(date: string): Promise<CheckinRecord[]> { return d1Query('SELECT * FROM checkin_records WHERE date = ?', [date]); }
export async function getCheckinRecordsByTypeAndDateRange(typeId: string, startDate: string, endDate: string): Promise<CheckinRecord[]> {
  return d1Query('SELECT * FROM checkin_records WHERE type_id = ? AND date >= ? AND date <= ? ORDER BY date ASC', [typeId, startDate, endDate]);
}
export async function upsertCheckinRecord(typeId: string, date: string, checked: number): Promise<void> {
  const existing = await d1Query('SELECT id FROM checkin_records WHERE type_id = ? AND date = ?', [typeId, date]);
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2);
  if (existing.length > 0) {
    await d1Query('UPDATE checkin_records SET checked = ? WHERE type_id = ? AND date = ?', [checked, typeId, date]);
  } else {
    await d1Query(`INSERT INTO checkin_records (id, type_id, checked, date, created_at) VALUES (?, ?, ?, ?, ?)`, [uid, typeId, checked, date, new Date().toISOString()]);
  }
}
export async function toggleCheckin(typeId: string, date: string): Promise<boolean> {
  const existing = await d1Query('SELECT id, checked FROM checkin_records WHERE type_id = ? AND date = ?', [typeId, date]) as CheckinRecord[];
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2);
  if (existing.length > 0) {
    const newChecked = existing[0].checked ? 0 : 1;
    await d1Query('UPDATE checkin_records SET checked = ? WHERE type_id = ? AND date = ?', [newChecked, typeId, date]);
    return newChecked === 1;
  } else {
    await d1Query(`INSERT INTO checkin_records (id, type_id, checked, date, created_at) VALUES (?, ?, 1, ?, ?)`, [uid, typeId, date, new Date().toISOString()]);
    return true;
  }
}

// ============= 思绪银河 =============
export async function getAllGalaxyThoughts(): Promise<GalaxyThought[]> { return d1Query('SELECT * FROM galaxy_thoughts ORDER BY created_at DESC'); }
export async function createGalaxyThought(t: GalaxyThought): Promise<GalaxyThought> {
  await d1Query(`INSERT INTO galaxy_thoughts (id, content, source, source_id, tags, is_done, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [t.id, t.content, t.source, t.source_id, t.tags, t.is_done, t.created_at]);
  return t;
}
export async function toggleGalaxyThoughtDone(id: string): Promise<boolean> {
  const existing = await d1Query('SELECT is_done FROM galaxy_thoughts WHERE id = ?', [id]) as { is_done: number }[];
  if (existing.length === 0) return false;
  const newDone = existing[0].is_done ? 0 : 1;
  await d1Query('UPDATE galaxy_thoughts SET is_done = ? WHERE id = ?', [newDone, id]);
  return true;
}
export async function deleteGalaxyThought(id: string): Promise<boolean> { const r = await d1Query('DELETE FROM galaxy_thoughts WHERE id = ?', [id]); return (r as any).meta?.changes > 0; }

// ============= 统计数据 =============
export async function getStats() {
  const [notes, inspirations, galaxy, emotions] = await Promise.all([
    d1Query('SELECT COUNT(*) as count FROM daily_notes'),
    d1Query("SELECT COUNT(*) as count FROM daily_notes WHERE inspiration IS NOT NULL AND inspiration != ''"),
    d1Query('SELECT COUNT(*) as count FROM galaxy_thoughts'),
    d1Query('SELECT COUNT(*) as count FROM emotion_records'),
  ]);
  const totalNotes = (notes[0] as any).count + (emotions[0] as any).count;
  const totalInspirations = (inspirations[0] as any).count + (galaxy[0] as any).count;

  const noteDates = await d1Query('SELECT DISTINCT date(created_at) as d FROM daily_notes ORDER BY d DESC') as { d: string }[];
  let streak = 0;
  for (let i = 0; i < noteDates.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    if (noteDates[i].d === expected) streak++;
    else break;
  }
  return { totalNotes, totalInspirations, streakDays: streak };
}

// ============= 活跃日历 =============
export async function getActivityDates(days: number = 84) {
  const startDate = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];
  const activeDates: Record<string, number> = {};

  const [noteDates, emotionDates, painDates, checkinDates] = await Promise.all([
    d1Query("SELECT date(created_at) as d, COUNT(*) as cnt FROM daily_notes WHERE date(created_at) >= ? AND date(created_at) <= ? GROUP BY date(created_at)", [startDate, endDate]),
    d1Query("SELECT date(created_at) as d, COUNT(*) as cnt FROM emotion_records WHERE date(created_at) >= ? AND date(created_at) <= ? GROUP BY date(created_at)", [startDate, endDate]),
    d1Query("SELECT date(created_at) as d, COUNT(*) as cnt FROM pain_points WHERE date(created_at) >= ? AND date(created_at) <= ? GROUP BY date(created_at)", [startDate, endDate]),
    d1Query("SELECT date, COUNT(*) as cnt FROM checkin_records WHERE date >= ? AND date <= ? AND checked = 1 GROUP BY date", [startDate, endDate]),
  ]);
  for (const r of noteDates as { d: string; cnt: number }[]) activeDates[r.d] = (activeDates[r.d] || 0) + r.cnt;
  for (const r of emotionDates as { d: string; cnt: number }[]) activeDates[r.d] = (activeDates[r.d] || 0) + r.cnt;
  for (const r of painDates as { d: string; cnt: number }[]) activeDates[r.d] = (activeDates[r.d] || 0) + r.cnt;
  for (const r of checkinDates as { date: string; cnt: number }[]) activeDates[r.date] = (activeDates[r.date] || 0) + r.cnt;
  return activeDates;
}

// ============= 本周报告 =============
export async function getWeeklyReport() {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now); monday.setDate(now.getDate() - dayOfWeek + 1); monday.setHours(0, 0, 0, 0);
  const mondayStr = monday.toISOString().split('T')[0];
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
  const sundayStr = sunday.toISOString().split('T')[0];
  const prevMonday = new Date(monday); prevMonday.setDate(monday.getDate() - 7);
  const prevMondayStr = prevMonday.toISOString().split('T')[0];
  const prevSunday = new Date(monday); prevSunday.setDate(monday.getDate() - 1);
  const prevSundayStr = prevSunday.toISOString().split('T')[0];

  const [weekNotes, prevNoteCount, weekEmotions, prevEmotionCount, weekPains, prevPainCount, weekMoods] = await Promise.all([
    d1Query("SELECT * FROM daily_notes WHERE date(created_at) >= ? AND date(created_at) <= ? ORDER BY created_at ASC", [mondayStr, sundayStr]),
    d1Query("SELECT COUNT(*) as c FROM daily_notes WHERE date(created_at) >= ? AND date(created_at) <= ?", [prevMondayStr, prevSundayStr]),
    d1Query("SELECT * FROM emotion_records WHERE date(created_at) >= ? AND date(created_at) <= ? ORDER BY created_at ASC", [mondayStr, sundayStr]),
    d1Query("SELECT COUNT(*) as c FROM emotion_records WHERE date(created_at) >= ? AND date(created_at) <= ?", [prevMondayStr, prevSundayStr]),
    d1Query("SELECT * FROM pain_points WHERE date(created_at) >= ? AND date(created_at) <= ? ORDER BY created_at ASC", [mondayStr, sundayStr]),
    d1Query("SELECT COUNT(*) as c FROM pain_points WHERE date(created_at) >= ? AND date(created_at) <= ?", [prevMondayStr, prevSundayStr]),
    d1Query("SELECT mood_emoji FROM daily_notes WHERE mood_emoji IS NOT NULL AND date(created_at) >= ? AND date(created_at) <= ? UNION ALL SELECT mood_emoji FROM emotion_records WHERE mood_emoji IS NOT NULL AND date(created_at) >= ? AND date(created_at) <= ?", [mondayStr, sundayStr, mondayStr, sundayStr]),
  ]);

  const moodDistribution: Record<string, number> = {};
  for (const m of weekMoods as { mood_emoji: string }[]) { if (m.mood_emoji) moodDistribution[m.mood_emoji] = (moodDistribution[m.mood_emoji] || 0) + 1; }

  const painTypeDistribution: Record<string, number> = {};
  for (const p of weekPains as PainPoint[]) { if (p.type) painTypeDistribution[p.type] = (painTypeDistribution[p.type] || 0) + 1; }

  const dailyCounts: Record<string, { notes: number; emotions: number; pains: number }> = {};
  for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); const ds = d.toISOString().split('T')[0]; dailyCounts[ds] = { notes: 0, emotions: 0, pains: 0 }; }
  for (const n of weekNotes as DailyNote[]) { const d = n.created_at.split('T')[0]; if (dailyCounts[d]) dailyCounts[d].notes++; }
  for (const e of weekEmotions as EmotionRecord[]) { const d = e.created_at.split('T')[0]; if (dailyCounts[d]) dailyCounts[d].emotions++; }
  for (const p of weekPains as PainPoint[]) { const d = p.created_at.split('T')[0]; if (dailyCounts[d]) dailyCounts[d].pains++; }

  const weekInspirationCount = (weekNotes as DailyNote[]).filter(n => n.inspiration && n.inspiration.trim()).length;
  const avgImpact = (weekPains as PainPoint[]).length > 0 ? Math.round((weekPains as PainPoint[]).reduce((s, p) => s + p.life_impact, 0) / (weekPains as PainPoint[]).length) : 0;

  return {
    weekRange: { start: mondayStr, end: sundayStr },
    dailyNotes: { count: weekNotes.length, prevCount: (prevNoteCount[0] as any).c, change: (prevNoteCount[0] as any).c > 0 ? weekNotes.length - (prevNoteCount[0] as any).c : (weekNotes.length > 0 ? weekNotes.length : 0), items: (weekNotes as DailyNote[]).map(n => ({ id: n.id, content: (n as any).content, mood_emoji: n.mood_emoji, inspiration: n.inspiration, created_at: n.created_at })) },
    emotions: { count: weekEmotions.length, prevCount: (prevEmotionCount[0] as any).c, change: (prevEmotionCount[0] as any).c > 0 ? weekEmotions.length - (prevEmotionCount[0] as any).c : (weekEmotions.length > 0 ? weekEmotions.length : 0), items: (weekEmotions as EmotionRecord[]).map(e => ({ id: e.id, trigger: (e as any).trigger, body_feeling: (e as any).body_feeling, thought: (e as any).thought, action: (e as any).action, mood_emoji: e.mood_emoji, created_at: e.created_at })) },
    painPoints: { count: weekPains.length, prevCount: (prevPainCount[0] as any).c, change: (prevPainCount[0] as any).c > 0 ? weekPains.length - (prevPainCount[0] as any).c : (weekPains.length > 0 ? weekPains.length : 0), items: (weekPains as PainPoint[]).map(p => ({ id: p.id, title: p.title, type: p.type, priority: p.priority, feeling: (p as any).feeling, plan: (p as any).plan, life_impact: p.life_impact, created_at: p.created_at })) },
    moodDistribution, painTypeDistribution, dailyCounts, weekInspirationCount, avgImpact,
  };
}

/** getDb 兼容接口 — 返回一个可以执行原生 SQL 的对象（用于 index.ts 中的直接 SQL） */
export function getDb() {
  return {
    prepare: (sql: string) => ({
      run: (...params: any[]) => d1Query(sql, params),
      get: (...params: any[]) => d1Query(sql, params).then(r => r[0]),
      all: (...params: any[]) => d1Query(sql, params),
    }),
  };
}
