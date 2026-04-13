'use client';
import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

const SNAP_HALF = 0.5;
const SNAP_MAX = 0.85;
const SNAP_MIN_PX = 120;

const BottomSheet = forwardRef(function BottomSheet({ children, header }, ref) {
  const sheetRef = useRef(null);
  const handleAreaRef = useRef(null);
  const dragState = useRef(null);

  // 외부 ref를 sheetRef DOM 요소로 연결
  useImperativeHandle(ref, () => sheetRef.current, []);

  const setHeight = useCallback((h) => {
    if (!sheetRef.current) return;
    sheetRef.current.style.height = `${h}px`;
  }, []);

  // 초기 높이 설정 + 리사이즈 대응
  useEffect(() => {
    const init = () => {
      const vh = window.innerHeight;
      setHeight(Math.round(vh * SNAP_HALF));
    };
    init();
    window.addEventListener('resize', init);
    return () => window.removeEventListener('resize', init);
  }, [setHeight]);

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    dragState.current = { startY: touch.clientY, startH: sheetRef.current?.offsetHeight || 0 };
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!sheetRef.current) return;
    const vh = window.innerHeight;
    const h = sheetRef.current.offsetHeight;
    const snaps = [SNAP_MIN_PX, Math.round(vh * SNAP_HALF), Math.round(vh * SNAP_MAX)];
    const closest = snaps.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a);
    setHeight(closest);
    dragState.current = null;
  }, [setHeight]);

  const onTouchCancel = useCallback(() => {
    dragState.current = null;
  }, []);

  // 비-passive touchmove 리스너 (e.preventDefault() 작동하게)
  useEffect(() => {
    const el = handleAreaRef.current;
    if (!el) return;

    const handleTouchMove = (e) => {
      if (!dragState.current || !sheetRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      const delta = dragState.current.startY - touch.clientY;
      const vh = window.innerHeight;
      const newH = Math.min(
        Math.max(dragState.current.startH + delta, SNAP_MIN_PX),
        Math.round(vh * SNAP_MAX)
      );
      sheetRef.current.style.height = `${newH}px`;
    };

    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, []);

  return (
    <div className="bottom-sheet" ref={sheetRef}>
      <div
        className="bottom-sheet-handle-area"
        ref={handleAreaRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        <div className="bottom-sheet-handle" />
      </div>
      {header && <div className="bottom-sheet-header">{header}</div>}
      <div className="bottom-sheet-content">
        {children}
      </div>
    </div>
  );
});

export default BottomSheet;

export function resetBottomSheet(sheetEl) {
  if (!sheetEl) return;
  const vh = window.innerHeight;
  sheetEl.style.height = `${Math.round(vh * SNAP_HALF)}px`;
}
