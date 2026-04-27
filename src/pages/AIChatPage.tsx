import { useState, useRef, useEffect } from 'react';

interface Props {
  onBack: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function AIChatPage({ onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: '你好！我是你的 AI 情感导师 ✨\n\n我在这里陪伴你观察自己、梳理情绪、探索内心。你可以和我聊聊：\n\n• 今天的心情和感受\n• 困扰你的情绪或事件\n• 人生中面临的挑战\n• 你的灵感和想法\n\n无论什么，我都会认真倾听 💙',
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => 'ai-' + Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    const assistantId = Date.now().toString() + '-a';
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', streaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text,
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text') {
              fullContent += event.content;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullContent } : m
              ));
            } else if (event.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: event.message || '抱歉，出现了一点问题，请稍后再试。', streaming: false } : m
              ));
            } else if (event.type === 'done') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content || '（无回复）', streaming: false } : m
              ));
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: '抱歉，出现了一点问题，请稍后再试。', streaming: false } : m
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="ai-page">
      {/* Header */}
      <div className="modal-header-bar">
        <button className="close-circle-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="#333" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="modal-header-center">
          <div className="modal-header-title">AI对话</div>
          <div className="modal-header-sub">深度观察自己</div>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* 消息列表 */}
      <div className="ai-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`ai-message ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="ai-avatar">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 3l1.5 1.5M16.5 3.5L15 5M10 1v2M1 10h2M17 10h2M10 19v-2" stroke="#7B68EE" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="10" cy="10" r="5" stroke="#7B68EE" strokeWidth="1.5"/>
                  <circle cx="10" cy="10" r="2" fill="#7B68EE"/>
                </svg>
              </div>
            )}
            <div className={`ai-bubble ${msg.role}`}>
              {msg.content.split('\n').map((line, i) => (
                <span key={i}>{line}{i < msg.content.split('\n').length - 1 && <br/>}</span>
              ))}
              {msg.streaming && <span className="typing-cursor">▌</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div className="ai-input-area">
        <div className="ai-input-row">
          <textarea
            ref={inputRef}
            className="ai-input"
            placeholder="输入你想说的话..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            className={`ai-send-btn ${loading || !input.trim() ? 'disabled' : ''}`}
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M18 2L2 8l6 4 4 6 6-16z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="ai-disclaimer">AI生成内容仅供参考，不构成专业建议</div>
      </div>
    </div>
  );
}
