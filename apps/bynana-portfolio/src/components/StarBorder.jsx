import '../styles/components/StarBorder.css';

function StarBorder({
  as = 'button',
  className = '',
  color = 'white',
  speed = '6s',
  thickness = 1,
  children,
  ...rest
}) {
  const Component = as
  const { style, ...restProps } = rest;

  return (
    <Component
      className={`star-border-container ${className}`.trim()}
      style={{
        padding: `${thickness}px`,
        ...style,
      }}
      {...restProps}
    >
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div className="inner-content">{children}</div>
    </Component>
  );
}

export default StarBorder;
