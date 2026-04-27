// ============= 业务数据类型 =============

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

export interface Stats {
  totalNotes: number;
  totalInspirations: number;
  streakDays: number;
}

// ============= UI 枚举 =============

export type MainTab = 'daily' | 'emotion' | 'pain';
export type AppPage = 'welcome' | 'home' | 'checkin' | 'galaxy' | 'ai' | 'report';

export const MOOD_OPTIONS = [
  { emoji: '😊', label: '开心' },
  { emoji: '😌', label: '平静' },
  { emoji: '😢', label: '难过' },
  { emoji: '😤', label: '愤怒' },
  { emoji: '😰', label: '焦虑' },
  { emoji: '😴', label: '疲惫' },
  { emoji: '🤩', label: '兴奋' },
  { emoji: '😔', label: '低落' },
];

export const PAIN_TYPES = ['健康', '工作', '关系', '财务', '成长', '情绪', '其他'];

export const CHECKIN_ICONS = ['📚', '🧘', '🏃', '💪', '🎯', '✍️', '🎨', '🎵', '🌱', '💤', '🥗', '💧'];

export const CHECKIN_COLORS = [
  '#4A90D9', '#7B68EE', '#20B2AA', '#FF7F7F', '#98D98E', '#FFB347',
  '#87CEEB', '#DDA0DD', '#F0E68C', '#98FB98', '#FFA07A', '#00CED1'
];
