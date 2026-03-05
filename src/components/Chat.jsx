import { useState, useEffect, useRef } from 'react';
import { db, ref, onValue } from '../firebase';
import { sendMessage, deleteMessage } from '../utils/room';

export default function Chat({ roomId, user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const messagesRef = ref(db, `rooms/${roomId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        return;
      }
      const list = Object.entries(data)
        .map(([id, msg]) => ({ id, ...msg }))
        .sort((a, b) => a.createdAt - b.createdAt);
      setMessages(list);
    });
    return () => unsubscribe();
  }, [roomId]);

  // 새 메시지 도착 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const textareaRef = useRef(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendMessage(roomId, user, trimmed);
      setText('');
      // 전송 후 높이 초기화 (필요시)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setSending(false);
    }
  };

  const handleNewline = () => {
    if (sending) return;
    setText(prev => prev + '\n');
    // 버튼 클릭 후 입력창에 다시 포커스
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // 스크롤을 맨 아래로
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    // Shift 키 없이 Enter만 누른 경우 전송
    if (e.key === 'Enter' && !e.shiftKey) {
      // 한글 입력 시 중복 이벤트 방지
      if (e.nativeEvent.isComposing) return;
      
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async (messageId) => {
    await deleteMessage(roomId, messageId);
  };

  return (
    <section className="chat-section">
      <h2 className="section-title">채팅</h2>
      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">첫 메시지를 보내보세요!</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.uid === user?.uid;
          return (
            <div key={msg.id} className={`chat-message ${isMine ? 'mine' : 'others'}`}>
              {!isMine && (
                <div className="chat-avatar">
                  {msg.profileImage
                    ? <img src={msg.profileImage} alt="" />
                    : <div className="chat-avatar-placeholder">{msg.nickname[0]}</div>
                  }
                </div>
              )}
              <div className="chat-bubble-wrap">
                {!isMine && <span className="chat-nickname">{msg.nickname}</span>}
                <div className="chat-bubble-row">
                  {isMine && (
                    <button className="chat-delete-btn" onClick={() => handleDelete(msg.id)}>
                      삭제
                    </button>
                  )}
                  <div className="chat-bubble">{msg.text}</div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          className="chat-input chat-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요"
          disabled={sending}
          maxLength={300}
          rows="1"
        />
        <div className="chat-btn-group">
          <button
            className="chat-newline-btn"
            onClick={handleNewline}
            disabled={sending}
            title="줄바꿈"
          >
            ↵
          </button>
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={sending || !text.trim()}
          >
            전송
          </button>
        </div>
      </div>
    </section>
  );
}
