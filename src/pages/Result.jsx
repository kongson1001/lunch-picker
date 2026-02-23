import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, ref, onValue } from '../firebase';
import Roulette from '../components/Roulette';

export default function Result() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteFinished, setRouletteFinished] = useState(false);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.result) {
        navigate(`/room/${roomId}`);
        return;
      }
      setRoom(data);

      if (data.result.isTie) {
        setShowRoulette(true);
      }
    });
    return () => unsubscribe();
  }, [roomId, navigate]);

  if (!room) return <div className="loading">결과 로딩 중...</div>;

  const { result, menus } = room;
  const { counts, topMenus, winnerId, winnerName, isTie } = result;

  const sortedMenus = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([menuId, count]) => ({
      menuId,
      name: menus[menuId]?.name || '알 수 없음',
      count,
      isWinner: menuId === winnerId,
      isTied: topMenus.includes(menuId),
    }));

  const maxVotes = sortedMenus[0]?.count || 1;

  return (
    <div className="result-container">
      <h1>투표 결과</h1>

      {isTie && showRoulette && !rouletteFinished && (
        <div className="tie-section">
          <p className="tie-message">동률 발생! 무작위 추첨 중...</p>
          <Roulette
            candidates={topMenus.map((id) => menus[id]?.name || '알 수 없음')}
            onFinish={() => setRouletteFinished(true)}
          />
        </div>
      )}

      {(!isTie || rouletteFinished) && (
        <div className="winner-section">
          <h2>오늘의 점심</h2>
          <div className="winner-name">{winnerName}</div>
          {isTie && <p className="tie-note">동률 추첨으로 선정되었습니다</p>}
        </div>
      )}

      <div className="vote-chart">
        <h3>전체 투표 결과</h3>
        {sortedMenus.map(({ menuId, name, count, isWinner }) => (
          <div key={menuId} className={`chart-bar ${isWinner ? 'winner' : ''}`}>
            <div className="bar-label">{name}</div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(count / maxVotes) * 100}%` }}
              />
            </div>
            <div className="bar-count">{count}표</div>
          </div>
        ))}
      </div>

      <button className="home-btn" onClick={() => navigate('/')}>
        메인으로
      </button>
    </div>
  );
}
