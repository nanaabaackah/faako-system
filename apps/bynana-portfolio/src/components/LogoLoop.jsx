import React from 'react';
import '../styles/components/LogoLoop.css';

function LogoLoop({ items, speed = 24, pauseOnHover = true, ariaLabel = 'Logo loop' }) {
  const loopClassName = `logo-loop ${pauseOnHover ? 'logo-loop--pause' : ''}`.trim();

  return (
    <div className={loopClassName} style={{ '--logo-loop-duration': `${speed}s` }} aria-label={ariaLabel}>
      <div className="logo-loop__track">
        {[0, 1].map((copy) => (
          <ul className="logo-loop__list" key={`loop-copy-${copy}`} aria-hidden={copy === 1}>
            {items.map(({ label, icon }) => {
              const Icon = icon

              return (
                <li className="logo-loop__item" key={`${copy}-${label}`} title={label} data-label={label}>
                  <Icon aria-hidden="true" />
                  <span className="sr-only">{label}</span>
                </li>
              )
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}

export default LogoLoop;
