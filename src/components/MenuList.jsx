export default function MenuList({ menus, votes, myVotes, onVote, onDelete, status }) {
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

  const getVoters = (menuId) => {
    if (!votes) return [];
    return Object.values(votes)
      .filter((vote) => vote.menuIds && vote.menuIds.includes(menuId))
      .map((vote) => vote.nickname);
  };

  const sortedMenus = Object.entries(menus || {})
    .map(([menuId, menu]) => ({ menuId, menu, voteCount: getVoteCount(menuId) }))
    .sort((a, b) => b.voteCount - a.voteCount);

  const topCount = sortedMenus.length > 0 ? sortedMenus[0].voteCount : 0;

  return (
    <div className="menu-list">
      {sortedMenus.map(({ menuId, menu, voteCount }) => {
        const voters = getVoters(menuId);
        const isVoted = myVotes.includes(menuId);
        const isFirst = voteCount > 0 && voteCount === topCount;

        return (
          <div key={menuId} className={`menu-item ${isVoted ? 'voted' : ''} ${isFirst ? 'first-place' : ''}`}>
            <div className="menu-info">
              <h3>
                {isFirst && <span className="crown">👑</span>}
                {menu.name}
              </h3>
              {menu.address && <p className="address">{menu.address}</p>}
              <span className="source-badge">
                {menu.source === 'search' ? '🔍 검색 추가' : menu.source === 'naver' ? '📍 주변 음식점' : '✏️ 직접 추가'}
              </span>
              {voters.length > 0 && (
                <p className="voter-list">{voters.join(', ')}</p>
              )}
            </div>
            <div className="menu-vote">
              <span className="vote-count">{voteCount}표</span>
              {status === 'voting' && (
                <>
                  <button
                    className={`vote-btn ${isVoted ? 'voted' : ''}`}
                    onClick={() => onVote(menuId)}
                  >
                    {isVoted ? '취소' : '투표'}
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => onDelete(menuId)}
                  >
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
