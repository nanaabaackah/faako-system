import React from "react";
import { InlineNotice as SharedInlineNotice } from "@faako/ui";
import { AppIcon } from "../Icon/Icon";
import { faCircleCheck, faClock, faRotateRight, faXmark } from "../../icons/iconSet";
import "./InlineNotice.css";

const NOTICE_META = {
  success: {
    icon: faCircleCheck,
    title: "Saved successfully",
    role: "status",
    live: "polite",
  },
  error: {
    icon: faXmark,
    title: "Action needed",
    role: "alert",
    live: "assertive",
  },
  info: {
    icon: faClock,
    title: "Heads up",
    role: "status",
    live: "polite",
  },
  loading: {
    icon: faRotateRight,
    title: "Working on it",
    role: "status",
    live: "polite",
  },
};

export function InlineNotice({
  tone = "info",
  title,
  message = "",
  className = "",
  compact = false,
}) {
  const meta = NOTICE_META[tone] || NOTICE_META.info;

  return (
    <SharedInlineNotice
      tone={tone}
      title={title || meta.title}
      message={message}
      compact={compact}
      className={`inline-notice inline-notice--${tone}${className ? ` ${className}` : ""}`}
      iconClassName="inline-notice__icon"
      bodyClassName="inline-notice__body"
      titleClassName="inline-notice__title"
      messageClassName="inline-notice__message"
      renderIcon={() => <AppIcon icon={meta.icon} />}
    />
  );
}

export function InlineNoticeStack({ notices = [], className = "", compact = false }) {
  const safeNotices = Array.isArray(notices) ? notices.filter(Boolean) : [];
  if (!safeNotices.length) return null;

  return (
    <div className={`inline-notice-stack${className ? ` ${className}` : ""}`}>
      {safeNotices.map((notice, index) => (
        <InlineNotice
          key={notice.key || `${notice.tone || "info"}-${index}`}
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
          compact={notice.compact ?? compact}
          className={notice.className}
        />
      ))}
    </div>
  );
}
