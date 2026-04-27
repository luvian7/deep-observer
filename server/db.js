import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var dbPath = path.join(__dirname, '..', 'data', 'observer.db');
var dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
var db = new Database(dbPath);
db.pragma('journal_mode = WAL');
// ============= 初始化所有表 =============
db.exec("\n  -- AI \u5BF9\u8BDD\u4F1A\u8BDD\u8868\n  CREATE TABLE IF NOT EXISTS sessions (\n    id TEXT PRIMARY KEY,\n    title TEXT NOT NULL,\n    model TEXT NOT NULL,\n    sdk_session_id TEXT,\n    created_at TEXT NOT NULL,\n    updated_at TEXT NOT NULL\n  );\n\n  CREATE TABLE IF NOT EXISTS messages (\n    id TEXT PRIMARY KEY,\n    session_id TEXT NOT NULL,\n    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),\n    content TEXT NOT NULL,\n    model TEXT,\n    created_at TEXT NOT NULL,\n    tool_calls TEXT,\n    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE\n  );\n\n  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);\n\n  -- \u6BCF\u65E5\u901F\u8BB0\u8868\n  CREATE TABLE IF NOT EXISTS daily_notes (\n    id TEXT PRIMARY KEY,\n    small_joy TEXT,\n    small_gain TEXT,\n    inspiration TEXT,\n    mood TEXT,\n    mood_emoji TEXT,\n    created_at TEXT NOT NULL,\n    updated_at TEXT NOT NULL\n  );\n\n  -- \u60C5\u7EEA\u68B3\u7406\u8868\n  CREATE TABLE IF NOT EXISTS emotion_records (\n    id TEXT PRIMARY KEY,\n    trigger_event TEXT,\n    my_feeling TEXT,\n    discovery TEXT,\n    next_action TEXT,\n    mood_emoji TEXT,\n    created_at TEXT NOT NULL,\n    updated_at TEXT NOT NULL\n  );\n\n  -- \u4EBA\u751F\u75DB\u70B9\u8868\n  CREATE TABLE IF NOT EXISTS pain_points (\n    id TEXT PRIMARY KEY,\n    title TEXT NOT NULL,\n    type TEXT,\n    my_feeling TEXT,\n    life_impact INTEGER DEFAULT 0,\n    urgency INTEGER DEFAULT 1,\n    change_plan TEXT,\n    priority INTEGER DEFAULT 0,\n    created_at TEXT NOT NULL,\n    updated_at TEXT NOT NULL\n  );\n\n  -- \u6253\u5361\u7C7B\u578B\u8868\n  CREATE TABLE IF NOT EXISTS checkin_types (\n    id TEXT PRIMARY KEY,\n    name TEXT NOT NULL,\n    icon TEXT,\n    target TEXT,\n    color TEXT DEFAULT '#4A90D9',\n    created_at TEXT NOT NULL\n  );\n\n  -- \u6BCF\u65E5\u6253\u5361\u8BB0\u5F55\u8868\n  CREATE TABLE IF NOT EXISTS checkin_records (\n    id TEXT PRIMARY KEY,\n    type_id TEXT NOT NULL,\n    checked INTEGER DEFAULT 0,\n    date TEXT NOT NULL,\n    created_at TEXT NOT NULL,\n    FOREIGN KEY (type_id) REFERENCES checkin_types(id) ON DELETE CASCADE\n  );\n\n  CREATE INDEX IF NOT EXISTS idx_checkin_records_date ON checkin_records(date);\n  CREATE INDEX IF NOT EXISTS idx_checkin_records_type_id ON checkin_records(type_id);\n\n  -- \u601D\u7EEA\u94F6\u6CB3\uFF08\u7075\u611F\u6C47\u603B\uFF09\u8868\n  CREATE TABLE IF NOT EXISTS galaxy_thoughts (\n    id TEXT PRIMARY KEY,\n    content TEXT NOT NULL,\n    source TEXT,\n    source_id TEXT,\n    tags TEXT,\n    is_done INTEGER DEFAULT 0,\n    created_at TEXT NOT NULL\n  );\n");
// 迁移：添加 sdk_session_id 列
try {
    var tableInfo = db.prepare("PRAGMA table_info(sessions)").all();
    var hasColumn = tableInfo.some(function (col) { return col.name === 'sdk_session_id'; });
    if (!hasColumn) {
        db.exec("ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT");
    }
}
catch (e) { }
// ============= 会话操作 =============
export function getAllSessions() {
    return db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all();
}
export function getSession(id) {
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}
export function createSession(session) {
    db.prepare("INSERT INTO sessions (id, title, model, sdk_session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(session.id, session.title, session.model, session.sdk_session_id, session.created_at, session.updated_at);
    return session;
}
export function updateSession(id, updates) {
    var _a;
    var fields = [];
    var values = [];
    if (updates.title !== undefined) {
        fields.push('title = ?');
        values.push(updates.title);
    }
    if (updates.model !== undefined) {
        fields.push('model = ?');
        values.push(updates.model);
    }
    if (updates.sdk_session_id !== undefined) {
        fields.push('sdk_session_id = ?');
        values.push(updates.sdk_session_id);
    }
    if (fields.length === 0)
        return false;
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    var result = (_a = db.prepare("UPDATE sessions SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values);
    return result.changes > 0;
}
export function deleteSession(id) {
    return db.prepare('DELETE FROM sessions WHERE id = ?').run(id).changes > 0;
}
// ============= 消息操作 =============
export function getMessagesBySession(sessionId) {
    return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId);
}
export function createMessage(message) {
    db.prepare("INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(message.id, message.session_id, message.role, message.content, message.model, message.created_at, message.tool_calls);
    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), message.session_id);
    return message;
}
export function updateMessage(id, updates) {
    var _a;
    var fields = [];
    var values = [];
    if (updates.content !== undefined) {
        fields.push('content = ?');
        values.push(updates.content);
    }
    if (updates.tool_calls !== undefined) {
        fields.push('tool_calls = ?');
        values.push(updates.tool_calls);
    }
    if (fields.length === 0)
        return false;
    values.push(id);
    return (_a = db.prepare("UPDATE messages SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values).changes > 0;
}
export function deleteMessage(id) {
    return db.prepare('DELETE FROM messages WHERE id = ?').run(id).changes > 0;
}
// ============= 每日速记 =============
export function getAllDailyNotes() {
    return db.prepare('SELECT * FROM daily_notes ORDER BY created_at DESC').all();
}
export function createDailyNote(note) {
    db.prepare("INSERT INTO daily_notes (id, small_joy, small_gain, inspiration, mood, mood_emoji, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(note.id, note.small_joy, note.small_gain, note.inspiration, note.mood, note.mood_emoji, note.created_at, note.updated_at);
    return note;
}
export function updateDailyNote(id, updates) {
    var _a;
    var fields = [];
    var values = [];
    var cols = ['small_joy', 'small_gain', 'inspiration', 'mood', 'mood_emoji'];
    for (var _i = 0, cols_1 = cols; _i < cols_1.length; _i++) {
        var col = cols_1[_i];
        if (updates[col] !== undefined) {
            fields.push("".concat(col, " = ?"));
            values.push(updates[col]);
        }
    }
    if (fields.length === 0)
        return false;
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    return (_a = db.prepare("UPDATE daily_notes SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values).changes > 0;
}
export function deleteDailyNote(id) {
    return db.prepare('DELETE FROM daily_notes WHERE id = ?').run(id).changes > 0;
}
// ============= 情绪梳理 =============
export function getAllEmotionRecords() {
    return db.prepare('SELECT * FROM emotion_records ORDER BY created_at DESC').all();
}
export function createEmotionRecord(record) {
    db.prepare("INSERT INTO emotion_records (id, trigger_event, my_feeling, discovery, next_action, mood_emoji, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(record.id, record.trigger_event, record.my_feeling, record.discovery, record.next_action, record.mood_emoji, record.created_at, record.updated_at);
    return record;
}
export function updateEmotionRecord(id, updates) {
    var _a;
    var fields = [];
    var values = [];
    var cols = ['trigger_event', 'my_feeling', 'discovery', 'next_action', 'mood_emoji'];
    for (var _i = 0, cols_2 = cols; _i < cols_2.length; _i++) {
        var col = cols_2[_i];
        if (updates[col] !== undefined) {
            fields.push("".concat(col, " = ?"));
            values.push(updates[col]);
        }
    }
    if (fields.length === 0)
        return false;
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    return (_a = db.prepare("UPDATE emotion_records SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values).changes > 0;
}
export function deleteEmotionRecord(id) {
    return db.prepare('DELETE FROM emotion_records WHERE id = ?').run(id).changes > 0;
}
// ============= 人生痛点 =============
export function getAllPainPoints() {
    return db.prepare('SELECT * FROM pain_points ORDER BY priority ASC, life_impact DESC').all();
}
export function createPainPoint(point) {
    db.prepare("INSERT INTO pain_points (id, title, type, my_feeling, life_impact, urgency, change_plan, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(point.id, point.title, point.type, point.my_feeling, point.life_impact, point.urgency, point.change_plan, point.priority, point.created_at, point.updated_at);
    return point;
}
export function updatePainPoint(id, updates) {
    var _a;
    var fields = [];
    var values = [];
    var cols = ['title', 'type', 'my_feeling', 'life_impact', 'urgency', 'change_plan', 'priority'];
    for (var _i = 0, cols_3 = cols; _i < cols_3.length; _i++) {
        var col = cols_3[_i];
        if (updates[col] !== undefined) {
            fields.push("".concat(col, " = ?"));
            values.push(updates[col]);
        }
    }
    if (fields.length === 0)
        return false;
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    return (_a = db.prepare("UPDATE pain_points SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values).changes > 0;
}
export function deletePainPoint(id) {
    return db.prepare('DELETE FROM pain_points WHERE id = ?').run(id).changes > 0;
}
// ============= 打卡类型 =============
export function getAllCheckinTypes() {
    return db.prepare('SELECT * FROM checkin_types ORDER BY created_at ASC').all();
}
export function createCheckinType(type) {
    db.prepare("INSERT INTO checkin_types (id, name, icon, target, color, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(type.id, type.name, type.icon, type.target, type.color, type.created_at);
    return type;
}
export function updateCheckinType(id, updates) {
    var _a;
    var fields = [];
    var values = [];
    var cols = ['name', 'icon', 'target', 'color'];
    for (var _i = 0, cols_4 = cols; _i < cols_4.length; _i++) {
        var col = cols_4[_i];
        if (updates[col] !== undefined) {
            fields.push("".concat(col, " = ?"));
            values.push(updates[col]);
        }
    }
    if (fields.length === 0)
        return false;
    values.push(id);
    return (_a = db.prepare("UPDATE checkin_types SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values).changes > 0;
}
export function deleteCheckinType(id) {
    return db.prepare('DELETE FROM checkin_types WHERE id = ?').run(id).changes > 0;
}
// ============= 打卡记录 =============
export function getCheckinRecordsByDate(date) {
    return db.prepare('SELECT * FROM checkin_records WHERE date = ?').all(date);
}
export function getCheckinRecordsByTypeAndDateRange(typeId, startDate, endDate) {
    return db.prepare('SELECT * FROM checkin_records WHERE type_id = ? AND date >= ? AND date <= ? ORDER BY date ASC')
        .all(typeId, startDate, endDate);
}
export function upsertCheckinRecord(typeId, date, checked) {
    var existing = db.prepare('SELECT id FROM checkin_records WHERE type_id = ? AND date = ?').get(typeId, date);
    var uid = Date.now().toString(36) + Math.random().toString(36).slice(2);
    if (existing) {
        db.prepare('UPDATE checkin_records SET checked = ? WHERE type_id = ? AND date = ?').run(checked, typeId, date);
    }
    else {
        db.prepare("INSERT INTO checkin_records (id, type_id, checked, date, created_at) VALUES (?, ?, ?, ?, ?)")
            .run(uid, typeId, checked, date, new Date().toISOString());
    }
}
export function toggleCheckin(typeId, date) {
    var existing = db.prepare('SELECT id, checked FROM checkin_records WHERE type_id = ? AND date = ?').get(typeId, date);
    var uid = Date.now().toString(36) + Math.random().toString(36).slice(2);
    if (existing) {
        var newChecked = existing.checked ? 0 : 1;
        db.prepare('UPDATE checkin_records SET checked = ? WHERE type_id = ? AND date = ?').run(newChecked, typeId, date);
        return newChecked === 1;
    }
    else {
        db.prepare("INSERT INTO checkin_records (id, type_id, checked, date, created_at) VALUES (?, ?, 1, ?, ?)")
            .run(uid, typeId, date, new Date().toISOString());
        return true;
    }
}
// ============= 思绪银河 =============
export function getAllGalaxyThoughts() {
    return db.prepare('SELECT * FROM galaxy_thoughts ORDER BY created_at DESC').all();
}
export function createGalaxyThought(thought) {
    db.prepare("INSERT INTO galaxy_thoughts (id, content, source, source_id, tags, is_done, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(thought.id, thought.content, thought.source, thought.source_id, thought.tags, thought.is_done, thought.created_at);
    return thought;
}
export function toggleGalaxyThoughtDone(id) {
    var existing = db.prepare('SELECT is_done FROM galaxy_thoughts WHERE id = ?').get(id);
    if (!existing)
        return false;
    var newDone = existing.is_done ? 0 : 1;
    db.prepare('UPDATE galaxy_thoughts SET is_done = ? WHERE id = ?').run(newDone, id);
    return true;
}
export function deleteGalaxyThought(id) {
    return db.prepare('DELETE FROM galaxy_thoughts WHERE id = ?').run(id).changes > 0;
}
// ============= 统计数据 =============
export function getStats() {
    var totalNotes = db.prepare('SELECT COUNT(*) as count FROM daily_notes').get().count;
    var totalInspirations = db.prepare("SELECT COUNT(*) as count FROM daily_notes WHERE inspiration IS NOT NULL AND inspiration != ''").get().count;
    var galaxyCount = db.prepare('SELECT COUNT(*) as count FROM galaxy_thoughts').get().count;
    // 计算连续打卡天数（基于 daily_notes）
    var noteDates = db.prepare('SELECT DISTINCT date(created_at) as d FROM daily_notes ORDER BY d DESC').all();
    var streak = 0;
    var today = new Date().toISOString().split('T')[0];
    for (var i = 0; i < noteDates.length; i++) {
        var expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        if (noteDates[i].d === expected)
            streak++;
        else
            break;
    }
    return {
        totalNotes: totalNotes + db.prepare('SELECT COUNT(*) as count FROM emotion_records').get().count,
        totalInspirations: totalInspirations + galaxyCount,
        streakDays: streak
    };
}
export default db;
