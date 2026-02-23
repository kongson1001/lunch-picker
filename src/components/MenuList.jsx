export default function MenuList({ menus, votes, myVotes, onVote, status }) {
  const getVoteCount = (menuId) => {
    let count = 0;
    if (votes) {
      Object.values(votes).forEach((vote) => {
        if (vote.menuIds && vote.menuIds.includes(menuId)) {
          count++;
        }
      });
    }
    return count;
  };

  return (
    <div className="menu-list">
      {Object.entries(menus || {}).map(([menuId, menu]) => {
        const voteCount = getVoteCount(menuId);
        const isVoted = myVotes.includes(menuId);

        return (
          <div key={menuId} className={`menu-item ${isVoted ? 'voted' : ''}`}>
            <div className="menu-info">
              <h3>{menu.name}</h3>
              {menu.address && <p className="address">{menu.address}</p>}
              <span className="source-badge">
                {menu.source === 'naver' ? '📍 주변 음식점' : '✏️ 직접 추가'}
              </span>
            </div>
            <div className="menu-vote">
              <span className="vote-count">{voteCount}표</span>
              {status === 'voting' && (
                <button
                  className={`vote-btn ${isVoted ? 'voted' : ''}`}
                  onClick={() => onVote(menuId)}
                >
                  {isVoted ? '취소' : '투표'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
