'use client';

// panels: [{ id, icon, label, disabled? }]
// activePanel: string (현재 패널 id)
// onSelect: (id) => void
// openPanels: string[] (데스크탑 멀티), activePanel: string (모바일 단일)
export function PanelIconBar({ panels, openPanels = null, activePanel, onSelect }) {
  return (
    <div className="room-icon-bar">
      {panels.map(({ id, icon, label, disabled }) => {
        const isActive = openPanels !== null ? openPanels.includes(id) : activePanel === id;
        return (
          <button
            key={id}
            disabled={!!disabled}
            className={`room-icon-btn${isActive ? ' active' : ''}${disabled ? ' disabled' : ''}`}
            onClick={() => onSelect(id)}
            aria-label={label}
          >
            <span className="room-icon-btn-icon">{icon}</span>
            <span className="room-icon-btn-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// 현재 패널 객체 반환 (activePanel과 일치하는 항목, 없으면 panels[0])
export function getPanelTitle(panels, activePanel) {
  return panels.find(p => p.id === activePanel) ?? panels[0];
}
