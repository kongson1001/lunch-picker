'use client';
import { useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';

export default function Chat({ roomId, user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  
  const bottomRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const isInitialMount = useRef(true);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/db/rooms/${roomId}/messages`);
      const data = await res.json();
      if (!data) { setMessages([]); return; }
      
      const list = Object.entries(data)
        .map(([id, msg]) => ({ id, ...msg }))
        .sort((a, b) => a.createdAt - b.createdAt);
      
      setMessages(list);
      if (isInitialMount.current) {
        scrollToBottom();
        isInitialMount.current = false;
      }
    } catch (err) { console.error('메시지 로딩 실패:', err); }
  };

  useEffect(() => {
    fetchMessages();

    // Pusher 실시간 수신기 설정
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    });

    const channel = pusher.subscribe('db-updated');
    channel.bind('update', (data) => {
      // 내 채팅방의 업데이트 신호일 때만 갱신
      if (data.path === 'rooms' && data.id === roomId) {
        fetchMessages();
      }
    });

    return () => {
      pusher.unsubscribe('db-updated');
    };
  }, [roomId]);

  const scrollToBottom = () => {
    setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await fetch(`/api/db/rooms/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          uid: user.uid, nickname: user.nickname, profileImage: user.profileImage || null, text: trimmed,
        })
      });
      setText('');
      fetchMessages();
    } finally { setSending(false); }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm('메시지를 삭제할까요?')) return;
    await fetch(`/api/db/rooms/${roomId}/messages/${messageId}`, { method: 'DELETE' });
    fetchMessages();
  };

  return (
    <section className="chat-section">
      <h2 className="section-title">채팅</h2>
      <div className="chat-messages-container">
        <div className="chat-messages" ref={chatMessagesRef}>
          {messages.map((msg) => {
            const isMine = msg.uid === user?.uid;
            return (
              <div key={msg.id} className={`chat-message ${isMine ? 'mine' : 'others'}`}>
                {!isMine && (
                  <div className="chat-avatar">
                    {msg.profileImage ? <img src={msg.profileImage} alt="" /> : <div className="chat-avatar-placeholder">{msg.nickname[0]}</div>}
                  </div>
                )}
                <div className="chat-bubble-wrap">
                  {!isMine && <span className="chat-nickname">{msg.nickname}</span>}
                  <div className="chat-bubble-row">
                    {(isMine || user?.isAdmin) && (
                      <div className="chat-actions">
                        <button className="chat-action-btn delete" onClick={() => deleteMessage(msg.id)}>삭제</button>
                      </div>
                    )}
                    <div className="chat-bubble">{msg.text}</div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="chat-input-row">
        <textarea className="chat-input chat-textarea" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="메시지를 입력하세요" disabled={sending} />
        <button className="chat-send-btn" onClick={handleSend} disabled={sending || !text.trim()}>전송</button>
      </div>
    </section>
  );
}
