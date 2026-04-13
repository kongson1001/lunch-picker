'use client';
import { useRef, useEffect, useCallback, forwardRef } from 'react';

const SNAP_HALF = 0.5;
const SNAP_MAX = 0.85;
const SNAP_MIN_PX = 120;

const BottomSheet = forwardRef(function BottomSheet({ children, header }, ref) {
  const sheetRef = useRef(null);
  const dragState = useRef(null);

  // ref를 외부에서 접근 가능하게 (resetBottomSheet에서 사용)
  useEffect(() => {
    if (ref && sheetRef.current) {
      if (typeof ref === 'function') ref(sheetRef.current);
      else ref.current = sheetRef.current;
    }
  }, [ref]);

  const setHeight = useCallback((h) => {
    if (!sheetRef.current) return;
    sheetRef.current.style.height = `${h}px`;
  }, []);

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

  const onTouchMove = useCallback((e) => {
    if (!dragState.current || !sheetRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const delta = dragState.current.startY - touch.clientY;
    const vh = window.innerHeight;
    const newH = Math.min(
      Math.max(dragState.current.startH + delta, SNAP_MIN_PX),
      Math.round(vh * SNAP_MAX)
    );
    setHeight(newH);
  }, [setHeight]);

  const onTouchEnd = useCallback(() => {
    if (!sheetRef.current) return;
    const vh = window.innerHeight;
    const h = sheetRef.current.offsetHeight;
    const snaps = [SNAP_MIN_PX, Math.round(vh * SNAP_HALF), Math.round(vh * SNAP_MAX)];
    const closest = snaps.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a);
    setHeight(closest);
    dragState.current = null;
  }, [setHeight]);

  return (
    <div className="bottom-sheet" ref={sheetRef}>
      <div
        className="bottom-sheet-handle-area"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
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
