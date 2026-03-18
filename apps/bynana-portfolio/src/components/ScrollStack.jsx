import React from 'react';

function ScrollStack({
  items = [],
  renderItem,
  className = '',
  minHeight = 'clamp(28rem, 74vh, 42rem)',
  role = 'list',
}) {
  if (!items.length || typeof renderItem !== 'function') return null;

  return (
    <div className={`scroll-stack ${className}`.trim()} role={role}>
      {items.map((item, index) => (
        <div
          key={item?.id ?? item?.slug ?? item?.href ?? item?.title ?? index}
          className="scroll-stack__item"
          role={role === 'list' ? 'listitem' : undefined}
          style={{
            '--stack-index': index,
            '--stack-z': index + 1,
            '--stack-min-height': minHeight,
          }}
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

export default ScrollStack;
