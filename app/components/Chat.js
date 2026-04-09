'use client';
import { useState, useEffect, useRef } from 'react';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const IMAGE_URL_RE = /(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg|bmp)(\?\S*)?)/i;

function ChatImagePreview({ url, rest }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span style={{ whiteSpace: 'pre-wrap' }}>{rest ? `${rest} ${url}` : url}</span>;
  return (
    <>
      {rest && <span style={{ whiteSpace: 'pre-wrap' }}>{rest}</span>}
      <img src={url} alt="" className="chat-image-preview" onError={() => setFailed(true)} />
    </>
  );
}

function renderMessageContent(text) {
  const match = text.match(IMAGE_URL_RE);
  if (!match) return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
  const url = match[0];
  const rest = text.replace(url, '').trim();
  return <ChatImagePreview url={url} rest={rest} />;
}

export default function Chat({ roomId, user }) {
  const [messages, setMessages] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
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
  const prevLengthRef = useRef(0);
  const fetchedUidsRef = useRef(new Set());

  const fetchProfiles = async (uids) => {
    const newUids = uids.filter(uid => uid && !fetchedUidsRef.current.has(uid));
    if (!newUids.length) return;
    newUids.forEach(uid => fetchedUidsRef.current.add(uid));
    const profiles = await Promise.all(
      newUids.map(uid => fetch(`/api/db/users/${uid}/profile`).then(r => r.json()).catch(() => null))
    );
    const map = {};
    newUids.forEach((uid, i) => { if (profiles[i]) map[uid] = profiles[i]; });
    setUserProfiles(prev => ({ ...prev, ...map }));
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/db/rooms/${roomId}/messages`);
      const data = await res.json();
      if (!data) { setMessages([]); isInitialMount.current = false; return; }

      const list = Object.entries(data)
        .map(([id, msg]) => ({ id, ...msg }))
        .sort((a, b) => a.createdAt - b.createdAt);

      const uids = [...new Set(list.map(m => m.uid).filter(Boolean))];
      fetchProfiles(uids);

      if (isInitialMount.current) {
        scrollToBottom();
        isInitialMount.current = false;
      } else if (list.length > prevLengthRef.current) {
        const lastMsg = list[list.length - 1];
        if (lastMsg.uid !== user?.uid) {
          handleNewMessageFromOthers(lastMsg);
        } else {
          scrollToBottom();
        }
      }

      prevLengthRef.current = list.length;
      setMessages(list);
    } catch (err) { console.error('메시지 로딩 실패:', err); }
  };

  useEffect(() => {
    fetchMessages();

    const es = new EventSource(`/api/sse?channel=rooms/${roomId}`);
    es.onmessage = () => fetchMessages();
    es.onerror = () => {};
    return () => es.close();
  }, [roomId]);

  const handleNewMessageFromOthers = (msg) => {
    const container = chatMessagesRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    if (isAtBottom) {
      scrollToBottom();
    } else {
      setNewMsgInfo(msg);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    }
  };

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
        body: JSON.stringify({ uid: user.uid, nickname: user.nickname, text: trimmed, isGuest: user?.isGuest || false }),
      });
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      fetchMessages();
    } finally { setSending(false); }
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
    await fetch(`/api/db/rooms/${roomId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ text: trimmed, updatedAt: Date.now() }),
    });
    setEditId(null);
    setEditInput('');
    fetchMessages();
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm('메시지를 삭제할까요?')) return;
    await fetch(`/api/db/rooms/${roomId}/messages/${messageId}`, { method: 'DELETE' });
    fetchMessages();
  };

  const handleReaction = async (messageId, emoji) => {
    if (!user) return;
    const path = `/api/db/rooms/${roomId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/${user.uid}`;
    const msg = messages.find(m => m.id === messageId);
    const hasVoted = msg?.reactions?.[emoji]?.[user.uid];
    await fetch(path, {
      method: hasVoted ? 'DELETE' : 'PUT',
      ...(hasVoted ? {} : { body: JSON.stringify({ nickname: user.nickname, timestamp: Date.now() }) }),
    });
    fetchMessages();
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

  return (
    <section className="chat-section">
      <h2 className="section-title">채팅</h2>
      <div className="chat-messages-container">
        <div className="chat-messages" ref={chatMessagesRef}>
          {messages.length === 0 && <p className="chat-empty">첫 메시지를 보내보세요!</p>}
          {messages.map((msg) => {
            const isMine = msg.uid === user?.uid;
            const isEditing = editId === msg.id;
            return (
              <div key={msg.id} className={`chat-message ${isMine ? 'mine' : 'others'}`}>
                {!isMine && (
                  <div className="chat-avatar">
                    {userProfiles[msg.uid]?.profileImage
                      ? <img src={userProfiles[msg.uid].profileImage} alt="" />
                      : <div className="chat-avatar-placeholder">{msg.nickname[0]}</div>}
                  </div>
                )}
                <div className="chat-bubble-wrap">
                  {!isMine && (
                    <span className="chat-nickname">
                      {msg.isGuest && <span className="guest-badge">👤</span>}
                      {msg.nickname}
                    </span>
                  )}
                  <div className="chat-bubble-row">
                    {(isMine || user?.isAdmin) && !isEditing && (
                      <div className="chat-actions">
                        {isMine && <button className="chat-action-btn edit" onClick={() => handleEditStart(msg)}>수정</button>}
                        <button className="chat-action-btn delete" onClick={() => deleteMessage(msg.id)}>삭제</button>
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
                        {renderMessageContent(msg.text)}
                        {msg.updatedAt && <span className="chat-edited-mark">(수정됨)</span>}
                      </div>
                    )}
                  </div>

                  <div className="chat-reactions-row">
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
                    <div className="reaction-picker-wrap">
                      <button className="add-reaction-btn">+</button>
                      <div className="reaction-picker">
                        {EMOJIS.map(emoji => (
                          <span key={emoji} onClick={() => handleReaction(msg.id, emoji)}>{emoji}</span>
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

        {showToast && (
          <div className="chat-new-msg-toast" onClick={() => { scrollToBottom(); setShowToast(false); }}>
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
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && (e.preventDefault(), handleSend())}
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
