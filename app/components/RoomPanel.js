'use client';

// panels: [{ id, icon, label, disabled? }]
// activePanel: string (현재 패널 id)
// onSelect: (id) => void
export function PanelIconBar({ panels, activePanel, onSelect }) {
  return (
    <div className="room-icon-bar">
      {panels.map(({ id, icon, disabled }) => (
        <button
          key={id}
          className={`room-icon-btn${activePanel === id ? ' active' : ''}${disabled ? ' disabled' : ''}`}
          onClick={() => !disabled && onSelect(id)}
          title={id}
          aria-label={id}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

// 현재 패널 객체 반환 (없으면 첫 번째)
export function getPanelTitle(panels, activePanel) {
  return panels.find(p => p.id === activePanel) ?? panels[0];
}
