const joinClasses = (...values) => values.filter(Boolean).join(" ");

export default function AdminPageHeader({
  className = "",
  copyClassName = "",
  actionsClassName = "admin-header-actions",
  eyebrow = "",
  eyebrowClassName = "admin-eyebrow",
  title,
  titleClassName = "",
  subtitle = "",
  subtitleClassName = "admin-subtitle",
  children = null,
  actions = null,
}) {
  return (
    <header className={joinClasses("admin-header", className)}>
      <div className={copyClassName || undefined}>
        {eyebrow ? <p className={eyebrowClassName}>{eyebrow}</p> : null}
        {title ? <h1 className={titleClassName || undefined}>{title}</h1> : null}
        {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
        {children}
      </div>
      {actions ? <div className={actionsClassName || undefined}>{actions}</div> : null}
    </header>
  );
}
