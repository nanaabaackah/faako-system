import { InlineNotice } from "@faako/ui";

export function InlineNoticeStack({ notices = [], className = "", compact = false }) {
  const visibleNotices = Array.isArray(notices) ? notices.filter(Boolean) : [];
  if (!visibleNotices.length) return null;
  return (
    <div className={`inline-notice-stack ${className}`.trim()}>
      {visibleNotices.map((notice, index) => (
        <InlineNotice
          key={notice.key || `${notice.tone || "info"}-${index}`}
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
          compact={notice.compact ?? compact}
        />
      ))}
    </div>
  );
}
