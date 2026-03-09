'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Roulette from '../../../components/Roulette';

export default function ResultPage() {
  const params = useParams();
  const roomId = params.roomId;
  const router = useRouter();
  const [room, setRoom] = useState(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteFinished, setRouletteFinished] = useState(false);

  const fetchResultData = async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/db/rooms/${roomId}`);
      const data = await res.json();
      if (!data || !data.result) {
        router.push(`/room/${roomId}`);
        return;
      }
      setRoom(data);
      if (data.result.isTie) setShowRoulette(true);
    } catch (err) {
      console.error('결과 로딩 실패:', err);
    }
  };

  useEffect(() => {
    fetchResultData();
  }, [roomId]);

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
    <div className="main-container result-layout">
      <div className="result-container">
        <h1>투표 결과</h1>
        {isTie && showRoulette && !rouletteFinished && (
          <div className="tie-section">
            <p className="tie-message">동률 발생! 무작위 추첨 중...</p>
            <Roulette candidates={topMenus.map((id) => menus[id]?.name || '알 수 없음')} onFinish={() => setRouletteFinished(true)} />
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
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / maxVotes) * 100}%` }} /></div>
              <div className="bar-count">{count}표</div>
            </div>
          ))}
        </div>
        <button className="home-btn" onClick={() => router.push('/')}>메인으로</button>
      </div>
    </div>
  );
}
