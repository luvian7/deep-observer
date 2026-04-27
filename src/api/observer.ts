import type { DailyNote, EmotionRecord, PainPoint, CheckinType, GalaxyThought, Stats } from '../types/observer';

const BASE = '/api';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ---- 每日速记 ----
export const dailyNotesApi = {
  list: () => req<{ data: DailyNote[] }>('/daily-notes').then(r => r.data),
  create: (data: Partial<DailyNote>) => req<{ data: DailyNote }>('/daily-notes', { method: 'POST', body: JSON.stringify(data) }).then(r => r.data),
  update: (id: string, data: Partial<DailyNote>) => req<{ success: boolean }>(`/daily-notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => req<{ success: boolean }>(`/daily-notes/${id}`, { method: 'DELETE' }),
};

// ---- 情绪梳理 ----
export const emotionRecordsApi = {
  list: () => req<{ data: EmotionRecord[] }>('/emotion-records').then(r => r.data),
  create: (data: Partial<EmotionRecord>) => req<{ data: EmotionRecord }>('/emotion-records', { method: 'POST', body: JSON.stringify(data) }).then(r => r.data),
  update: (id: string, data: Partial<EmotionRecord>) => req<{ success: boolean }>(`/emotion-records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => req<{ success: boolean }>(`/emotion-records/${id}`, { method: 'DELETE' }),
};

// ---- 人生痛点 ----
export const painPointsApi = {
  list: () => req<{ data: PainPoint[] }>('/pain-points').then(r => r.data),
  create: (data: Partial<PainPoint>) => req<{ data: PainPoint }>('/pain-points', { method: 'POST', body: JSON.stringify(data) }).then(r => r.data),
  update: (id: string, data: Partial<PainPoint>) => req<{ success: boolean }>(`/pain-points/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => req<{ success: boolean }>(`/pain-points/${id}`, { method: 'DELETE' }),
};

// ---- 打卡类型 ----
export const checkinTypesApi = {
  list: () => req<{ data: CheckinType[] }>('/checkin-types').then(r => r.data),
  create: (data: Partial<CheckinType>) => req<{ data: CheckinType }>('/checkin-types', { method: 'POST', body: JSON.stringify(data) }).then(r => r.data),
  update: (id: string, data: Partial<CheckinType>) => req<{ success: boolean }>(`/checkin-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => req<{ success: boolean }>(`/checkin-types/${id}`, { method: 'DELETE' }),
};

// ---- 打卡记录 ----
export const checkinRecordsApi = {
  listByDate: (date?: string) => req<{ data: Array<{ type_id: string; checked: number; date: string }> }>(`/checkin-records${date ? `?date=${date}` : ''}`).then(r => r.data),
  toggle: (type_id: string, date?: string) => req<{ checked: boolean }>('/checkin-records/toggle', { method: 'POST', body: JSON.stringify({ type_id, date }) }),
  range: (type_id: string, start: string, end: string) => req<{ data: Array<{ date: string; checked: number }> }>(`/checkin-records/range?type_id=${type_id}&start=${start}&end=${end}`).then(r => r.data),
};

// ---- 思绪银河 ----
export const galaxyApi = {
  list: () => req<{ data: GalaxyThought[] }>('/galaxy-thoughts').then(r => r.data),
  create: (data: Partial<GalaxyThought>) => req<{ data: GalaxyThought }>('/galaxy-thoughts', { method: 'POST', body: JSON.stringify(data) }).then(r => r.data),
  toggle: (id: string) => req<{ success: boolean }>(`/galaxy-thoughts/${id}/toggle`, { method: 'POST' }),
  delete: (id: string) => req<{ success: boolean }>(`/galaxy-thoughts/${id}`, { method: 'DELETE' }),
};

// ---- 统计 ----
export const statsApi = {
  get: () => req<Stats>('/stats'),
};

// ---- 本周报告 ----
export interface WeeklyReport {
  weekRange: { start: string; end: string };
  dailyNotes: { count: number; prevCount: number; change: number; items: Array<{ id: number; content: string; mood_emoji: string | null; inspiration: string | null; created_at: string }> };
  emotions: { count: number; prevCount: number; change: number; items: Array<{ id: number; trigger: string; body_feeling: string; thought: string; action: string; mood_emoji: string | null; created_at: string }> };
  painPoints: { count: number; prevCount: number; change: number; items: Array<{ id: number; title: string; type: string; priority: number; feeling: string; plan: string; life_impact: number; created_at: string }> };
  moodDistribution: Record<string, number>;
  painTypeDistribution: Record<string, number>;
  dailyCounts: Record<string, { notes: number; emotions: number; pains: number }>;
  weekInspirationCount: number;
  avgImpact: number;
}

export const weeklyReportApi = {
  get: () => req<{ data: WeeklyReport }>('/weekly-report').then(r => r.data),
};
