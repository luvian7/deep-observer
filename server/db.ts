import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'observer.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

/** 暴露底层数据库实例，供 index.ts 执行原生 SQL */
export function getDb() { return db; }

// ============= 初始化所有表 =============
db.exec(`
  -- AI 对话会话表
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
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL,
    tool_calls TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

  -- 每日速记表
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

  -- 情绪梳理表
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

  -- 人生痛点表
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

  -- 打卡类型表
  CREATE TABLE IF NOT EXISTS checkin_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    target TEXT,
    color TEXT DEFAULT '#4A90D9',
    created_at TEXT NOT NULL
  );

  -- 每日打卡记录表
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

  -- 思绪银河（灵感汇总）表
  CREATE TABLE IF NOT EXISTS galaxy_thoughts (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    source TEXT,
    source_id TEXT,
    tags TEXT,
    is_done INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

// 迁移：添加 sdk_session_id 列
try {
  const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const hasColumn = tableInfo.some(col => col.name === 'sdk_session_id');
  if (!hasColumn) {
    db.exec("ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT");
  }
} catch (e) {}

// ============= 类型定义 =============

export interface DbSession {
  id: string;
  title: string;
  model: string;
  sdk_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  created_at: string;
  tool_calls: string | null;
}

export interface DailyNote {
  id: string;
  small_joy?: string;
  small_gain?: string;
  inspiration?: string;
  mood?: string;
  mood_emoji?: string;
  created_at: string;
  updated_at: string;
}

export interface EmotionRecord {
  id: string;
  trigger_event?: string;
  my_feeling?: string;
  discovery?: string;
  next_action?: string;
  mood_emoji?: string;
  created_at: string;
  updated_at: string;
}

export interface PainPoint {
  id: string;
  title: string;
  type?: string;
  my_feeling?: string;
  life_impact: number;
  urgency: number;
  change_plan?: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface CheckinType {
  id: string;
  name: string;
  icon?: string;
  target?: string;
  color: string;
  created_at: string;
}

export interface CheckinRecord {
  id: string;
  type_id: string;
  checked: number;
  date: string;
  created_at: string;
}

export interface GalaxyThought {
  id: string;
  content: string;
  source?: string;
  source_id?: string;
  tags?: string;
  is_done: number;
  created_at: string;
}

// ============= 会话操作 =============

export function getAllSessions(): DbSession[] {
  return db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as DbSession[];
}

export function getSession(id: string): DbSession | undefined {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as DbSession | undefined;
}

export function createSession(session: DbSession): DbSession {
  db.prepare(`INSERT INTO sessions (id, title, model, sdk_session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(session.id, session.title, session.model, session.sdk_session_id, session.created_at, session.updated_at);
  return session;
}

export function updateSession(id: string, updates: Partial<Pick<DbSession, 'title' | 'model' | 'sdk_session_id'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.model !== undefined) { fields.push('model = ?'); values.push(updates.model); }
  if (updates.sdk_session_id !== undefined) { fields.push('sdk_session_id = ?'); values.push(updates.sdk_session_id); }
  if (fields.length === 0) return false;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  const result = db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteSession(id: string): boolean {
  return db.prepare('DELETE FROM sessions WHERE id = ?').run(id).changes > 0;
}

// ============= 消息操作 =============

export function getMessagesBySession(sessionId: string): DbMessage[] {
  return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as DbMessage[];
}

export function createMessage(message: DbMessage): DbMessage {
  db.prepare(`INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(message.id, message.session_id, message.role, message.content, message.model, message.created_at, message.tool_calls);
  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), message.session_id);
  return message;
}

export function updateMessage(id: string, updates: Partial<Pick<DbMessage, 'content' | 'tool_calls'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
  if (updates.tool_calls !== undefined) { fields.push('tool_calls = ?'); values.push(updates.tool_calls); }
  if (fields.length === 0) return false;
  values.push(id);
  return db.prepare(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

export function deleteMessage(id: string): boolean {
  return db.prepare('DELETE FROM messages WHERE id = ?').run(id).changes > 0;
}

// ============= 每日速记 =============

export function getAllDailyNotes(): DailyNote[] {
  return db.prepare('SELECT * FROM daily_notes ORDER BY created_at DESC').all() as DailyNote[];
}

export function createDailyNote(note: DailyNote): DailyNote {
  db.prepare(`INSERT INTO daily_notes (id, small_joy, small_gain, inspiration, mood, mood_emoji, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(note.id, note.small_joy, note.small_gain, note.inspiration, note.mood, note.mood_emoji, note.created_at, note.updated_at);
  return note;
}

export function updateDailyNote(id: string, updates: Partial<Omit<DailyNote, 'id' | 'created_at'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  const cols = ['small_joy', 'small_gain', 'inspiration', 'mood', 'mood_emoji'] as const;
  for (const col of cols) {
    if (updates[col] !== undefined) { fields.push(`${col} = ?`); values.push(updates[col]); }
  }
  if (fields.length === 0) return false;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  return db.prepare(`UPDATE daily_notes SET ${fields.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

export function deleteDailyNote(id: string): boolean {
  return db.prepare('DELETE FROM daily_notes WHERE id = ?').run(id).changes > 0;
}

// ============= 情绪梳理 =============

export function getAllEmotionRecords(): EmotionRecord[] {
  return db.prepare('SELECT * FROM emotion_records ORDER BY created_at DESC').all() as EmotionRecord[];
}

export function createEmotionRecord(record: EmotionRecord): EmotionRecord {
  db.prepare(`INSERT INTO emotion_records (id, trigger_event, my_feeling, discovery, next_action, mood_emoji, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(record.id, record.trigger_event, record.my_feeling, record.discovery, record.next_action, record.mood_emoji, record.created_at, record.updated_at);
  return record;
}

export function updateEmotionRecord(id: string, updates: Partial<Omit<EmotionRecord, 'id' | 'created_at'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  const cols = ['trigger_event', 'my_feeling', 'discovery', 'next_action', 'mood_emoji'] as const;
  for (const col of cols) {
    if (updates[col] !== undefined) { fields.push(`${col} = ?`); values.push(updates[col]); }
  }
  if (fields.length === 0) return false;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  return db.prepare(`UPDATE emotion_records SET ${fields.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

export function deleteEmotionRecord(id: string): boolean {
  return db.prepare('DELETE FROM emotion_records WHERE id = ?').run(id).changes > 0;
}

// ============= 人生痛点 =============

export function getAllPainPoints(): PainPoint[] {
  return db.prepare('SELECT * FROM pain_points ORDER BY priority ASC, life_impact DESC').all() as PainPoint[];
}

export function createPainPoint(point: PainPoint): PainPoint {
  db.prepare(`INSERT INTO pain_points (id, title, type, my_feeling, life_impact, urgency, change_plan, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(point.id, point.title, point.type, point.my_feeling, point.life_impact, point.urgency, point.change_plan, point.priority, point.created_at, point.updated_at);
  return point;
}

export function updatePainPoint(id: string, updates: Partial<Omit<PainPoint, 'id' | 'created_at'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  const cols = ['title', 'type', 'my_feeling', 'life_impact', 'urgency', 'change_plan', 'priority'] as const;
  for (const col of cols) {
    if (updates[col] !== undefined) { fields.push(`${col} = ?`); values.push(updates[col]); }
  }
  if (fields.length === 0) return false;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  return db.prepare(`UPDATE pain_points SET ${fields.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

export function deletePainPoint(id: string): boolean {
  return db.prepare('DELETE FROM pain_points WHERE id = ?').run(id).changes > 0;
}

// ============= 打卡类型 =============

export function getAllCheckinTypes(): CheckinType[] {
  return db.prepare('SELECT * FROM checkin_types ORDER BY created_at ASC').all() as CheckinType[];
}

export function createCheckinType(type: CheckinType): CheckinType {
  db.prepare(`INSERT INTO checkin_types (id, name, icon, target, color, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(type.id, type.name, type.icon, type.target, type.color, type.created_at);
  return type;
}

export function updateCheckinType(id: string, updates: Partial<Omit<CheckinType, 'id' | 'created_at'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  const cols = ['name', 'icon', 'target', 'color'] as const;
  for (const col of cols) {
    if (updates[col] !== undefined) { fields.push(`${col} = ?`); values.push(updates[col]); }
  }
  if (fields.length === 0) return false;
  values.push(id);
  return db.prepare(`UPDATE checkin_types SET ${fields.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

export function deleteCheckinType(id: string): boolean {
  return db.prepare('DELETE FROM checkin_types WHERE id = ?').run(id).changes > 0;
}

// ============= 打卡记录 =============

export function getCheckinRecordsByDate(date: string): CheckinRecord[] {
  return db.prepare('SELECT * FROM checkin_records WHERE date = ?').all(date) as CheckinRecord[];
}

export function getCheckinRecordsByTypeAndDateRange(typeId: string, startDate: string, endDate: string): CheckinRecord[] {
  return db.prepare('SELECT * FROM checkin_records WHERE type_id = ? AND date >= ? AND date <= ? ORDER BY date ASC')
    .all(typeId, startDate, endDate) as CheckinRecord[];
}

export function upsertCheckinRecord(typeId: string, date: string, checked: number): void {
  const existing = db.prepare('SELECT id FROM checkin_records WHERE type_id = ? AND date = ?').get(typeId, date) as { id: string } | undefined;
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2);
  if (existing) {
    db.prepare('UPDATE checkin_records SET checked = ? WHERE type_id = ? AND date = ?').run(checked, typeId, date);
  } else {
    db.prepare(`INSERT INTO checkin_records (id, type_id, checked, date, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(uid, typeId, checked, date, new Date().toISOString());
  }
}

export function toggleCheckin(typeId: string, date: string): boolean {
  const existing = db.prepare('SELECT id, checked FROM checkin_records WHERE type_id = ? AND date = ?').get(typeId, date) as CheckinRecord | undefined;
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2);
  if (existing) {
    const newChecked = existing.checked ? 0 : 1;
    db.prepare('UPDATE checkin_records SET checked = ? WHERE type_id = ? AND date = ?').run(newChecked, typeId, date);
    return newChecked === 1;
  } else {
    db.prepare(`INSERT INTO checkin_records (id, type_id, checked, date, created_at) VALUES (?, ?, 1, ?, ?)`)
      .run(uid, typeId, date, new Date().toISOString());
    return true;
  }
}

// ============= 思绪银河 =============

export function getAllGalaxyThoughts(): GalaxyThought[] {
  return db.prepare('SELECT * FROM galaxy_thoughts ORDER BY created_at DESC').all() as GalaxyThought[];
}

export function createGalaxyThought(thought: GalaxyThought): GalaxyThought {
  db.prepare(`INSERT INTO galaxy_thoughts (id, content, source, source_id, tags, is_done, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(thought.id, thought.content, thought.source, thought.source_id, thought.tags, thought.is_done, thought.created_at);
  return thought;
}

export function toggleGalaxyThoughtDone(id: string): boolean {
  const existing = db.prepare('SELECT is_done FROM galaxy_thoughts WHERE id = ?').get(id) as { is_done: number } | undefined;
  if (!existing) return false;
  const newDone = existing.is_done ? 0 : 1;
  db.prepare('UPDATE galaxy_thoughts SET is_done = ? WHERE id = ?').run(newDone, id);
  return true;
}

export function deleteGalaxyThought(id: string): boolean {
  return db.prepare('DELETE FROM galaxy_thoughts WHERE id = ?').run(id).changes > 0;
}

// ============= 统计数据 =============

export function getStats() {
  const totalNotes = (db.prepare('SELECT COUNT(*) as count FROM daily_notes').get() as any).count;
  const totalInspirations = (db.prepare("SELECT COUNT(*) as count FROM daily_notes WHERE inspiration IS NOT NULL AND inspiration != ''").get() as any).count;
  const galaxyCount = (db.prepare('SELECT COUNT(*) as count FROM galaxy_thoughts').get() as any).count;

  // 计算连续打卡天数（基于 daily_notes）
  const noteDates = db.prepare('SELECT DISTINCT date(created_at) as d FROM daily_notes ORDER BY d DESC').all() as { d: string }[];
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  for (let i = 0; i < noteDates.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    if (noteDates[i].d === expected) streak++;
    else break;
  }

  return {
    totalNotes: totalNotes + (db.prepare('SELECT COUNT(*) as count FROM emotion_records').get() as any).count,
    totalInspirations: totalInspirations + galaxyCount,
    streakDays: streak
  };
}

// ============= 活跃日历（GitHub 贡献图风格） =============

export function getActivityDates(days: number = 84) {
  // 统计最近 days 天内，每天是否有记录（速记/情绪/痛点/打卡任一即可）
  const startDate = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];

  const activeDates: Record<string, number> = {};

  // 速记
  const noteDates = db.prepare("SELECT date(created_at) as d, COUNT(*) as cnt FROM daily_notes WHERE date(created_at) >= ? AND date(created_at) <= ? GROUP BY date(created_at)")
    .all(startDate, endDate) as { d: string; cnt: number }[];
  noteDates.forEach(r => { activeDates[r.d] = (activeDates[r.d] || 0) + r.cnt; });

  // 情绪梳理
  const emotionDates = db.prepare("SELECT date(created_at) as d, COUNT(*) as cnt FROM emotion_records WHERE date(created_at) >= ? AND date(created_at) <= ? GROUP BY date(created_at)")
    .all(startDate, endDate) as { d: string; cnt: number }[];
  emotionDates.forEach(r => { activeDates[r.d] = (activeDates[r.d] || 0) + r.cnt; });

  // 痛点
  const painDates = db.prepare("SELECT date(created_at) as d, COUNT(*) as cnt FROM pain_points WHERE date(created_at) >= ? AND date(created_at) <= ? GROUP BY date(created_at)")
    .all(startDate, endDate) as { d: string; cnt: number }[];
  painDates.forEach(r => { activeDates[r.d] = (activeDates[r.d] || 0) + r.cnt; });

  // 打卡记录
  const checkinDates = db.prepare("SELECT date, COUNT(*) as cnt FROM checkin_records WHERE date >= ? AND date <= ? AND checked = 1 GROUP BY date")
    .all(startDate, endDate) as { date: string; cnt: number }[];
  checkinDates.forEach(r => { activeDates[r.date] = (activeDates[r.date] || 0) + r.cnt; });

  return activeDates;
}

// ============= 本周报告统计 =============

export function getWeeklyReport() {
  // 获取本周的起止日期（周一到周日）
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // 周日 = 7
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  monday.setHours(0, 0, 0, 0);
  const mondayStr = monday.toISOString().split('T')[0];

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const sundayStr = sunday.toISOString().split('T')[0];

  // 上周的起止日期
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const prevMondayStr = prevMonday.toISOString().split('T')[0];
  const prevSunday = new Date(monday);
  prevSunday.setDate(monday.getDate() - 1);
  const prevSundayStr = prevSunday.toISOString().split('T')[0];

  // 本周速记
  const weekNotes = db.prepare(
    "SELECT * FROM daily_notes WHERE date(created_at) >= ? AND date(created_at) <= ? ORDER BY created_at ASC"
  ).all(mondayStr, sundayStr) as DailyNote[];
  const weekNoteCount = weekNotes.length;

  // 上周速记
  const prevNoteCount = (db.prepare(
    "SELECT COUNT(*) as c FROM daily_notes WHERE date(created_at) >= ? AND date(created_at) <= ?"
  ).get(prevMondayStr, prevSundayStr) as { c: number }).c;

  // 本周情绪梳理
  const weekEmotions = db.prepare(
    "SELECT * FROM emotion_records WHERE date(created_at) >= ? AND date(created_at) <= ? ORDER BY created_at ASC"
  ).all(mondayStr, sundayStr) as EmotionRecord[];
  const weekEmotionCount = weekEmotions.length;

  // 上周情绪
  const prevEmotionCount = (db.prepare(
    "SELECT COUNT(*) as c FROM emotion_records WHERE date(created_at) >= ? AND date(created_at) <= ?"
  ).get(prevMondayStr, prevSundayStr) as { c: number }).c;

  // 本周人生痛点
  const weekPains = db.prepare(
    "SELECT * FROM pain_points WHERE date(created_at) >= ? AND date(created_at) <= ? ORDER BY created_at ASC"
  ).all(mondayStr, sundayStr) as PainPoint[];
  const weekPainCount = weekPains.length;

  // 上周痛点
  const prevPainCount = (db.prepare(
    "SELECT COUNT(*) as c FROM pain_points WHERE date(created_at) >= ? AND date(created_at) <= ?"
  ).get(prevMondayStr, prevSundayStr) as { c: number }).c;

  // 本周心情分布（从速记 + 情绪梳理中提取）
  const weekMoods = db.prepare(
    "SELECT mood_emoji FROM daily_notes WHERE mood_emoji IS NOT NULL AND date(created_at) >= ? AND date(created_at) <= ? UNION ALL SELECT mood_emoji FROM emotion_records WHERE mood_emoji IS NOT NULL AND date(created_at) >= ? AND date(created_at) <= ?"
  ).all(mondayStr, sundayStr, mondayStr, sundayStr) as { mood_emoji: string }[];

  const moodDistribution: Record<string, number> = {};
  for (const m of weekMoods) {
    if (m.mood_emoji) moodDistribution[m.mood_emoji] = (moodDistribution[m.mood_emoji] || 0) + 1;
  }

  // 本周痛点类型分布
  const painTypeDistribution: Record<string, number> = {};
  for (const p of weekPains) {
    if (p.type) painTypeDistribution[p.type] = (painTypeDistribution[p.type] || 0) + 1;
  }

  // 本周每日记录数
  const dailyCounts: Record<string, { notes: number; emotions: number; pains: number }> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    dailyCounts[ds] = { notes: 0, emotions: 0, pains: 0 };
  }
  for (const n of weekNotes) {
    const d = n.created_at.split('T')[0];
    if (dailyCounts[d]) dailyCounts[d].notes++;
  }
  for (const e of weekEmotions) {
    const d = e.created_at.split('T')[0];
    if (dailyCounts[d]) dailyCounts[d].emotions++;
  }
  for (const p of weekPains) {
    const d = p.created_at.split('T')[0];
    if (dailyCounts[d]) dailyCounts[d].pains++;
  }

  // 本周灵感数
  const weekInspirationCount = weekNotes.filter(n => n.inspiration && n.inspiration.trim()).length;

  // 本周平均生活影响度
  const avgImpact = weekPains.length > 0
    ? Math.round(weekPains.reduce((s, p) => s + p.life_impact, 0) / weekPains.length)
    : 0;

  return {
    weekRange: { start: mondayStr, end: sundayStr },
    dailyNotes: {
      count: weekNoteCount,
      prevCount: prevNoteCount,
      change: prevNoteCount > 0 ? weekNoteCount - prevNoteCount : (weekNoteCount > 0 ? weekNoteCount : 0),
      items: weekNotes.map(n => ({
        id: n.id,
        content: n.content,
        mood_emoji: n.mood_emoji,
        inspiration: n.inspiration,
        created_at: n.created_at,
      })),
    },
    emotions: {
      count: weekEmotionCount,
      prevCount: prevEmotionCount,
      change: prevEmotionCount > 0 ? weekEmotionCount - prevEmotionCount : (weekEmotionCount > 0 ? weekEmotionCount : 0),
      items: weekEmotions.map(e => ({
        id: e.id,
        trigger: e.trigger,
        body_feeling: e.body_feeling,
        thought: e.thought,
        action: e.action,
        mood_emoji: e.mood_emoji,
        created_at: e.created_at,
      })),
    },
    painPoints: {
      count: weekPainCount,
      prevCount: prevPainCount,
      change: prevPainCount > 0 ? weekPainCount - prevPainCount : (weekPainCount > 0 ? weekPainCount : 0),
      items: weekPains.map(p => ({
        id: p.id,
        title: p.title,
        type: p.type,
        priority: p.priority,
        feeling: p.feeling,
        plan: p.plan,
        life_impact: p.life_impact,
        created_at: p.created_at,
      })),
    },
    moodDistribution,
    painTypeDistribution,
    dailyCounts,
    weekInspirationCount,
    avgImpact,
  };
}

export default db;
