'use client';

export function formatSchedule(schedule) {
  if (!schedule?.date) return '날짜 없음';
  const d = new Date(schedule.date + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dateStr = `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  if (!schedule.hasTime) return dateStr;
  const h = String(schedule.hour).padStart(2, '0');
  const m = String(schedule.minute).padStart(2, '0');
  return `${dateStr} ${h}:${m}`;
}

export default function ScheduleVote({ schedules, scheduleVotes, myScheduleVotes, onVote, onDelete, status }) {
  const getVoteCount = (scheduleId) => {
    if (!scheduleVotes) return 0;
    return Object.values(scheduleVotes).filter(
      v => v.scheduleIds && v.scheduleIds.includes(scheduleId)
    ).length;
  };

  const getVoters = (scheduleId) => {
    if (!scheduleVotes) return [];
    return Object.values(scheduleVotes)
      .filter(v => v.scheduleIds && v.scheduleIds.includes(scheduleId))
      .map(v => ({ nickname: v.nickname, isGuest: v.isGuest || false }));
  };

  const sorted = Object.entries(schedules || {})
    .map(([id, s]) => ({ id, s, voteCount: getVoteCount(id) }))
    .sort((a, b) => b.voteCount - a.voteCount);

  const topCount = sorted.length > 0 ? sorted[0].voteCount : 0;

  if (sorted.length === 0) {
    return <p className="empty-schedules">아직 일정 후보가 없습니다. 추가해보세요!</p>;
  }

  return (
    <div className="schedule-list">
      {sorted.map(({ id, s, voteCount }) => {
        const voters = getVoters(id);
        const isVoted = myScheduleVotes.includes(id);
        const isFirst = voteCount > 0 && voteCount === topCount;
        return (
          <div key={id} className={`schedule-item ${isVoted ? 'voted' : ''} ${isFirst ? 'first-place' : ''}`}>
            <div className="schedule-info">
              <h3>
                {isFirst && <span className="crown">👑</span>}
                {formatSchedule(s)}
              </h3>
              <span className="schedule-added-by">제안: {s.addedBy}</span>
              {voters.length > 0 && (
                <p className="voter-list">
                  {voters.map((v, i) => (
                    <span key={i}>
                      {i > 0 && ', '}
                      {v.isGuest && <span className="guest-badge">👤</span>}
                      {v.nickname}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <div className="schedule-vote-actions">
              <span className="vote-count">{voteCount}표</span>
              {status === 'voting' && (
                <>
                  <button
                    className={`vote-btn ${isVoted ? 'voted' : ''}`}
                    onClick={() => onVote(id)}
                  >
                    {isVoted ? '취소' : '투표'}
                  </button>
                  <button className="delete-btn" onClick={() => onDelete(id)}>
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
