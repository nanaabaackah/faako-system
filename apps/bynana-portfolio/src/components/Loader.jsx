import React from 'react';

function Loader({ active = false }) {
  return (
    <div className={`site-loader ${active ? 'is-active' : ''}`} aria-hidden={!active}>
      <div className="site-loader__veil" />
      <div className="site-loader__content" role="status" aria-live="polite">
        <span className="site-loader__label">Loading</span>
        <span className="site-loader__pulse" aria-hidden="true" />
      </div>
      <span className="site-loader__bar" aria-hidden="true" />
    </div>
  );
}

export default Loader;
