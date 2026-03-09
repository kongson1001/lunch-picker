'use client';
import { useState, useEffect } from 'react';
import { searchRestaurants } from '../utils/naverSearch';
import { addFavorite, removeFavorite, getFavorites } from '../utils/favorites';
import { useAuth } from '../contexts/AuthContext';

export default function RestaurantSearch({ lat, lng, areaName, onAdd, onResults, addedNames }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState('search');

  useEffect(() => {
    if (user && activeTab === 'favorites') {
      loadFavorites();
    }
  }, [user, activeTab]);

  const loadFavorites = async () => {
    if (!user) return;
    try {
      const favs = await getFavorites(user.uid);
      setFavorites(favs);
    } catch (err) {
      console.error('즐겨찾기 로딩 실패:', err);
    }
  };

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    try {
      const data = await searchRestaurants(trimmed, lat, lng);
      setResults(data);
      if (onResults) onResults(data);
      setActiveTab('search');
    } catch (err) {
      console.error('검색 오류:', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const toggleFavorite = async (e, restaurant) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;

    const restaurantName = (restaurant.name || restaurant.title || '').replace(/<[^>]*>?/gm, '');
    const isFav = favorites.some(f => f.name === restaurantName);

    try {
      if (isFav) {
        const favToDelete = favorites.find(f => f.name === restaurantName);
        if (favToDelete) {
          await removeFavorite(user.uid, favToDelete.id);
        }
      } else {
        await addFavorite(user.uid, {
          name: restaurantName,
          category: restaurant.category,
          address: restaurant.address,
          roadAddress: restaurant.roadAddress,
          mapx: restaurant.mapx,
          mapy: restaurant.mapy
        });
      }
      await loadFavorites();
    } catch (err) {
      console.error('즐겨찾기 처리 실패:', err);
      alert('즐겨찾기 처리 중 오류가 발생했습니다.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const isFavorite = (restaurant) => {
    const restaurantName = (restaurant.name || restaurant.title || '').replace(/<[^>]*>?/gm, '');
    return favorites.some(f => f.name === restaurantName);
  };

  return (
    <div className="restaurant-search">
      <div className="search-tabs">
        <button 
          className={`search-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          🔍 검색
        </button>
        <button 
          className={`search-tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => setActiveTab('favorites')}
        >
          ⭐ 즐겨찾기
        </button>
      </div>

      {activeTab === 'search' ? (
        <>
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
                const isFav = isFavorite(r);
                return (
                  <li key={i} className="search-result-item">
                    <div className="search-result-info">
                      <div className="search-result-title-row">
                        <strong>{r.name}</strong>
                        <button 
                          className={`favorite-btn ${isFav ? 'active' : ''}`}
                          onClick={(e) => toggleFavorite(e, r)}
                        >
                          {isFav ? '⭐' : '☆'}
                        </button>
                      </div>
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
        </>
      ) : (
        <div className="favorites-list">
          {favorites.length > 0 ? (
            <ul className="search-results">
              {favorites.map((r, i) => {
                const isAdded = addedNames.has(r.name);
                return (
                  <li key={i} className="search-result-item">
                    <div className="search-result-info">
                      <div className="search-result-title-row">
                        <strong>{r.name}</strong>
                        <button 
                          className="favorite-btn active"
                          onClick={(e) => toggleFavorite(e, r)}
                        >
                          ⭐
                        </button>
                      </div>
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
          ) : (
            <p className="search-no-results">즐겨찾기한 맛집이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
