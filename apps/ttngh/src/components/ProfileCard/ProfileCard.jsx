import { memo, useCallback, useEffect, useRef } from "react";
import "./ProfileCard.css";

const clamp = (value, min = 0, max = 100) => Math.min(Math.max(value, min), max);

function ProfileCardComponent({ avatarUrl, name, title, enableTilt = true }) {
  const cardRef = useRef(null);
  const frameRef = useRef(null);

  const setPointerPosition = useCallback((clientX, clientY) => {
    const card = cardRef.current;
    if (!card) return;

    const bounds = card.getBoundingClientRect();
    const pointerX = clamp(((clientX - bounds.left) / bounds.width) * 100);
    const pointerY = clamp(((clientY - bounds.top) / bounds.height) * 100);
    const rotateX = (50 - pointerY) / 7;
    const rotateY = (pointerX - 50) / 7;

    card.style.setProperty("--pointer-x", `${pointerX}%`);
    card.style.setProperty("--pointer-y", `${pointerY}%`);
    card.style.setProperty("--rotate-x", `${rotateX}deg`);
    card.style.setProperty("--rotate-y", `${rotateY}deg`);
  }, []);

  const handlePointerMove = useCallback(
    (event) => {
      if (!enableTilt || event.pointerType === "touch") return;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => setPointerPosition(event.clientX, event.clientY));
    },
    [enableTilt, setPointerPosition],
  );

  const handlePointerLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--pointer-x", "50%");
    card.style.setProperty("--pointer-y", "50%");
    card.style.setProperty("--rotate-x", "0deg");
    card.style.setProperty("--rotate-y", "0deg");
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return (
    <article
      ref={cardRef}
      className="pc-card-wrapper"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label={`${name}, ${title}`}
    >
      <span className="pc-behind" aria-hidden="true" />
      <div className="pc-card-shell">
        <div className="pc-card">
          <div className="pc-inside">
            <img className="pc-avatar" src={avatarUrl} alt={name} width="800" height="1100" loading="lazy" decoding="async" />
            <span className="pc-shine" aria-hidden="true" />
            <span className="pc-glare" aria-hidden="true" />
            <div className="pc-details">
              <h3>{name}</h3>
              <p>{title}</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(ProfileCardComponent);
