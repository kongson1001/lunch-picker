import { useState, useEffect, useRef } from 'react';
import { db, ref, onValue } from '../firebase';
import { sendMessage, deleteMessage } from '../utils/room';

export default function Chat({ roomId, user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const [showToast, setShowToast] = useState(false);
  const [newMsgInfo, setNewMsgInfo] = useState(null);
  const chatMessagesRef = useRef(null);
  const isInitialMount = useRef(true);

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
      
      // 새 메시지 감지 로직
      if (!isInitialMount.current && list.length > messages.length) {
        const lastMsg = list[list.length - 1];
        // 내가 보낸 메시지가 아닐 때만 알림 처리
        if (lastMsg.uid !== user?.uid) {
          handleNewMessageFromOthers(lastMsg);
        } else {
          // 내가 보낸 메시지는 즉시 스크롤
          scrollToBottom();
        }
      }
      
      setMessages(list);
      isInitialMount.current = false;
    });
    return () => unsubscribe();
  }, [roomId, messages.length, user?.uid]);

  const handleNewMessageFromOthers = (msg) => {
    const container = chatMessagesRef.current;
    if (!container) return;

    // 사용자가 현재 맨 아래에 있는지 확인 (여유값 50px)
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

    if (isAtBottom) {
      scrollToBottom();
    } else {
      // 맨 아래가 아니면 알림 표시
      setNewMsgInfo(msg);
      setShowToast(true);
      // 3초 후 자동 소멸
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleToastClick = () => {
    scrollToBottom();
    setShowToast(false);
  };

  const textareaRef = useRef(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendMessage(roomId, user, trimmed);
      setText('');
      // 전송 후 높이 초기화 및 포커스 유지
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    } finally {
      setSending(false);
      // 비동기 처리 완료 후에도 한 번 더 확실히 포커스
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleNewline = () => {
    if (sending || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // 현재 커서 위치에 줄바꿈(\n) 삽입
    const newText = text.substring(0, start) + '\n' + text.substring(end);
    setText(newText);

    // 상태 업데이트 후 커서 위치 조정
    setTimeout(() => {
      textarea.focus();
      // 삽입된 \n 바로 뒤로 커서 이동
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      
      // 스크롤 위치 조정 (필요한 경우)
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      textarea.scrollTop = textarea.scrollHeight;
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
      <div className="chat-messages" ref={chatMessagesRef}>
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
        
        {/* 새 메시지 알림 토스트 */}
        {showToast && (
          <div className="chat-new-msg-toast" onClick={handleToastClick}>
            <span className="toast-nickname">{newMsgInfo?.nickname}: </span>
            <span className="toast-text">{newMsgInfo?.text}</span>
            <span className="toast-arrow">↓</span>
          </div>
        )}
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
