'use client';
import { useState, useEffect } from 'react';

export default function Roulette({ candidates, onFinish }) {
  const [current, setCurrent] = useState(0);
  const [spinning, setSpinning] = useState(true);

  useEffect(() => {
    if (!spinning) return;

    let interval = 50;
    let count = 0;
    const totalSpins = 20 + Math.floor(Math.random() * 10);

    const spin = () => {
      setCurrent((prev) => (prev + 1) % candidates.length);
      count++;

      if (count >= totalSpins) {
        setSpinning(false);
        onFinish();
        return;
      }

      interval = 50 + (count / totalSpins) * 300;
      setTimeout(spin, interval);
    };

    setTimeout(spin, interval);
  }, [candidates, spinning, onFinish]);

  return (
    <div className="roulette">
      <div className="roulette-display">
        <h2 className={spinning ? 'spinning' : 'winner'}>
          {candidates[current]}
        </h2>
      </div>
      {!spinning && <p className="roulette-label">당첨!</p>}
    </div>
  );
}
