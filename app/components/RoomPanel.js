'use client';

// panels: [{ id, icon, label, disabled? }]
// activePanel: string (현재 패널 id)
// onSelect: (id) => void
export function PanelIconBar({ panels, activePanel, onSelect }) {
  return (
    <div className="room-icon-bar">
      {panels.map(({ id, icon, label, disabled }) => (
        <button
          key={id}
          disabled={!!disabled}
          className={`room-icon-btn${activePanel === id ? ' active' : ''}${disabled ? ' disabled' : ''}`}
          onClick={() => onSelect(id)}
          title={label}
          aria-label={label}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

// 현재 패널 객체 반환 (activePanel과 일치하는 항목, 없으면 panels[0])
export function getPanelTitle(panels, activePanel) {
  return panels.find(p => p.id === activePanel) ?? panels[0];
}
