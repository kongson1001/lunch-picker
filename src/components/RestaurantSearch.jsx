import { useState } from 'react';
import { searchRestaurants } from '../utils/naverSearch';

export default function RestaurantSearch({ lat, lng, areaName, onAdd, onResults, addedNames }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    try {
      const data = await searchRestaurants(trimmed, lat, lng);
      setResults(data);
      if (onResults) onResults(data);
    } catch (err) {
      console.error('검색 오류:', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="restaurant-search">
      <div className="search-bar">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="음식점 검색 (예: 파스타, 중국집)"
          disabled={searching}
        />
        <button onClick={handleSearch} disabled={searching || !query.trim()}>
          {searching ? '검색 중...' : '검색'}
        </button>
      </div>

      {areaName && (
        <p className="search-area-info">검색 지역: {areaName}</p>
      )}

      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r, i) => {
            const isAdded = addedNames.has(r.name);
            return (
              <li key={i} className="search-result-item">
                <div className="search-result-info">
                  <strong>{r.name}</strong>
                  {r.category && <span className="search-category">{r.category}</span>}
                  {r.address && <p className="search-address">{r.address}</p>}
                </div>
                <button
                  className={`search-add-btn ${isAdded ? 'added' : ''}`}
                  onClick={() => onAdd(r)}
                  disabled={isAdded}
                >
                  {isAdded ? '추가됨' : '추가'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {results.length === 0 && !searching && query.trim() && (
        <p className="search-no-results">검색 결과가 없습니다.</p>
      )}
    </div>
  );
}
