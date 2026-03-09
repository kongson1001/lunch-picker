'use client';
import { useState } from 'react';

export default function AddMenu({ onAdd }) {
  const [menuName, setMenuName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!menuName.trim()) return;
    onAdd(menuName.trim());
    setMenuName('');
  };

  return (
    <form className="add-menu" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="먹고 싶은 메뉴를 추가하세요"
        value={menuName}
        onChange={(e) => setMenuName(e.target.value)}
        maxLength={30}
      />
      <button type="submit">+ 추가</button>
    </form>
  );
}
