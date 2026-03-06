import { useState, useEffect, useRef } from 'react';
import { db, ref, onValue } from '../firebase';
import { sendMessage, deleteMessage, editMessage, toggleReaction } from '../utils/room';

export default function Chat({ roomId, user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [newMsgInfo, setNewMsgInfo] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editInput, setEditInput] = useState('');
  
  const bottomRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const textareaRef = useRef(null);
  const isInitialMount = useRef(true);

  // 이모지 목록
  const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  useEffect(() => {
    const messagesRef = ref(db, `rooms/${roomId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        isInitialMount.current = false;
        return;
      }
      
      const list = Object.entries(data)
        .map(([id, msg]) => ({ id, ...msg }))
        .sort((a, b) => a.createdAt - b.createdAt);
      
      // 새 메시지 감지 로직
      if (!isInitialMount.current && list.length > messages.length) {
        const lastMsg = list[list.length - 1];
        if (lastMsg.uid !== user?.uid) {
          handleNewMessageFromOthers(lastMsg);
        } else {
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

    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    if (isAtBottom) {
      scrollToBottom();
    } else {
      setNewMsgInfo(msg);
      setShowToast(true);
      // 알림창이 사라지기 전에 내용이 바뀌면 타이머 갱신
      const timer = setTimeout(() => setShowToast(false), 4000);
      return () => clearTimeout(timer);
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

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendMessage(roomId, user, trimmed);
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleEditStart = (msg) => {
    setEditId(msg.id);
    setEditInput(msg.text);
  };

  const handleEditCancel = () => {
    setEditId(null);
    setEditInput('');
  };

  const handleEditSave = async (messageId) => {
    const trimmed = editInput.trim();
    if (!trimmed) return;
    try {
      await editMessage(roomId, messageId, trimmed);
      setEditId(null);
      setEditInput('');
    } catch (err) {
      console.error('메시지 수정 실패:', err);
    }
  };

  const handleReaction = async (messageId, emoji) => {
    if (!user) return;
    try {
      await toggleReaction(roomId, messageId, emoji, user);
    } catch (err) {
      console.error('반응 추가 실패:', err);
    }
  };

  const handleNewline = () => {
    if (sending || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = text.substring(0, start) + '\n' + text.substring(end);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + 1;
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section className="chat-section">
      <h2 className="section-title">채팅</h2>
      <div className="chat-messages-container">
        <div className="chat-messages" ref={chatMessagesRef}>
          {messages.length === 0 && (
            <p className="chat-empty">첫 메시지를 보내보세요!</p>
          )}
          {messages.map((msg) => {
            const isMine = msg.uid === user?.uid;
            const isEditing = editId === msg.id;

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
                    {(isMine || user?.isAdmin) && !isEditing && (
                      <div className="chat-actions">
                        {isMine && (
                          <button className="chat-action-btn edit" onClick={() => handleEditStart(msg)}>수정</button>
                        )}
                        <button className="chat-action-btn delete" onClick={() => deleteMessage(roomId, msg.id)}>삭제</button>
                      </div>
                    )}
                    {isEditing ? (
                      <div className="chat-edit-box">
                        <textarea 
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          className="chat-edit-input"
                          autoFocus
                        />
                        <div className="chat-edit-buttons">
                          <button onClick={() => handleEditSave(msg.id)}>저장</button>
                          <button onClick={handleEditCancel}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <div className="chat-bubble">
                        {msg.text}
                        {msg.updatedAt && <span className="chat-edited-mark">(수정됨)</span>}
                      </div>
                    )}
                  </div>
                  
                  {/* 반응 표시 및 추가 레이어 */}
                  <div className="chat-reactions-row">
                    {/* 선택된 반응들 */}
                    {msg.reactions && Object.entries(msg.reactions).map(([emoji, uids]) => {
                      const count = Object.keys(uids).length;
                      const hasVoted = user && uids[user.uid];
                      return (
                        <button 
                          key={emoji} 
                          className={`reaction-badge ${hasVoted ? 'active' : ''}`}
                          onClick={() => handleReaction(msg.id, emoji)}
                        >
                          {emoji} {count}
                        </button>
                      );
                    })}
                    
                    {/* 반응 추가 버튼 */}
                    <div className="reaction-picker-wrap">
                      <button className="add-reaction-btn">+</button>
                      <div className="reaction-picker">
                        {EMOJIS.map(emoji => (
                          <span 
                            key={emoji} 
                            onClick={() => handleReaction(msg.id, emoji)}
                          >
                            {emoji}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        
        {/* 새 메시지 알림 토스트 (컨테이너 내부로 이동 및 위치 수정) */}
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
          <button className="chat-newline-btn" onClick={handleNewline} disabled={sending}>↵</button>
          <button className="chat-send-btn" onClick={handleSend} disabled={sending || !text.trim()}>전송</button>
        </div>
      </div>
    </section>
  );
}
