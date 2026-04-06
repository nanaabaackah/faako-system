import { PageHeader } from "@faako/ui";

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
    <PageHeader
      className={`admin-header${className ? ` ${className}` : ""}`}
      copyClassName={copyClassName}
      actionsClassName={actionsClassName}
      eyebrow={eyebrow}
      eyebrowClassName={eyebrowClassName}
      title={title}
      titleClassName={titleClassName}
      subtitle={subtitle}
      subtitleClassName={subtitleClassName}
      actions={actions}
    >
      {children}
    </PageHeader>
  );
}
