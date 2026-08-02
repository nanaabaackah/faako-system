import {
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  ERPActionBar,
  ERPDangerAction,
  ERPIconAction,
  ERPPrimaryAction,
  ERPSecondaryAction,
} from "./ERPActions";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type ERPDialogSize = "sm" | "md" | "lg" | "xl";

type ERPDialogBaseProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  open: boolean;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
};

function useDialogEscape(open: boolean, closeOnEscape: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return undefined;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, onClose, open]);
}

function useDialogFocus(
  open: boolean,
  dialogRef: { current: HTMLElement | null },
) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const getFocusableElements = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getAttribute("aria-hidden") !== "true",
      );

    const focusFrame = window.requestAnimationFrame(() => {
      if (dialog.contains(document.activeElement)) return;
      const preferred =
        dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]")
        || getFocusableElements()[0]
        || dialog;
      preferred.focus();
    });

    const containFocus = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", containFocus);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", containFocus);
      document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [dialogRef, open]);
}

function getDialogAria({
  title,
  description,
  titleId,
  descriptionId,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
}: {
  title?: ReactNode;
  description?: ReactNode;
  titleId: string;
  descriptionId: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}) {
  return {
    "aria-label": ariaLabel || undefined,
    "aria-labelledby": ariaLabel ? undefined : ariaLabelledBy || (title ? titleId : undefined),
    "aria-describedby": ariaDescribedBy || (description ? descriptionId : undefined),
  };
}

export function ERPModal({
  open,
  className = "",
  title,
  description = "",
  children,
  footer = null,
  onClose,
  closeLabel = "Close dialog",
  closeOnEscape = true,
  closeOnBackdrop = false,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  size = "md",
  ...props
}: ERPDialogBaseProps & {
  size?: ERPDialogSize;
}) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogEscape(open, closeOnEscape, onClose);
  useDialogFocus(open, dialogRef);

  if (!open) return null;

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop || event.target !== event.currentTarget) return;
    onClose?.();
  };

  return (
    <div className="ui-erp-dialog-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div
        ref={dialogRef}
        className={joinClasses("ui-erp-modal", `ui-erp-modal--${size}`, className)}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        {...getDialogAria({
          title,
          description,
          titleId,
          descriptionId,
          ariaLabel,
          ariaLabelledBy,
          ariaDescribedBy,
        })}
        {...props}
      >
        <header className="ui-erp-dialog__header">
          <div>
            {title ? <h2 id={titleId}>{title}</h2> : null}
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {onClose ? (
            <ERPIconAction className="ui-erp-dialog__close" label={closeLabel} onClick={onClose}>
              ×
            </ERPIconAction>
          ) : null}
        </header>
        <div className="ui-erp-dialog__body">{children}</div>
        {footer ? <footer className="ui-erp-dialog__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function ERPDrawer({
  open,
  className = "",
  title,
  description = "",
  children,
  footer = null,
  onClose,
  closeLabel = "Close drawer",
  closeOnEscape = true,
  closeOnBackdrop = false,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  side = "right",
  ...props
}: ERPDialogBaseProps & {
  side?: "right" | "left" | "bottom";
}) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const drawerRef = useRef<HTMLElement>(null);
  useDialogEscape(open, closeOnEscape, onClose);
  useDialogFocus(open, drawerRef);

  if (!open) return null;

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop || event.target !== event.currentTarget) return;
    onClose?.();
  };

  return (
    <div
      className={joinClasses("ui-erp-dialog-backdrop", `ui-erp-dialog-backdrop--drawer-${side}`)}
      onMouseDown={handleBackdropMouseDown}
    >
      <aside
        ref={drawerRef}
        className={joinClasses("ui-erp-drawer", `ui-erp-drawer--${side}`, className)}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        {...getDialogAria({
          title,
          description,
          titleId,
          descriptionId,
          ariaLabel,
          ariaLabelledBy,
          ariaDescribedBy,
        })}
        {...props}
      >
        <header className="ui-erp-dialog__header">
          <div>
            {title ? <h2 id={titleId}>{title}</h2> : null}
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {onClose ? (
            <ERPIconAction className="ui-erp-dialog__close" label={closeLabel} onClick={onClose}>
              ×
            </ERPIconAction>
          ) : null}
        </header>
        <div className="ui-erp-dialog__body">{children}</div>
        {footer ? <footer className="ui-erp-dialog__footer">{footer}</footer> : null}
      </aside>
    </div>
  );
}

export function ERPConfirmDialog({
  open,
  title = "Confirm action",
  description = "",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "danger",
  loading = false,
  disabled = false,
  onConfirm,
  onCancel,
  onClose = onCancel,
  children = null,
  ...props
}: Omit<ERPDialogBaseProps, "footer" | "onClose" | "children"> & {
  message?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  confirmTone?: "primary" | "danger";
  loading?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onClose?: () => void;
  children?: ReactNode;
}) {
  const ConfirmAction = confirmTone === "primary" ? ERPPrimaryAction : ERPDangerAction;

  return (
    <ERPModal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      size="sm"
      role="alertdialog"
      footer={
        <ERPActionBar align="end">
          <ERPSecondaryAction
            autoFocus
            data-dialog-initial-focus
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </ERPSecondaryAction>
          <ConfirmAction onClick={onConfirm} loading={loading} disabled={disabled}>
            {confirmLabel}
          </ConfirmAction>
        </ERPActionBar>
      }
      {...props}
    >
      {message ? <p className="ui-erp-confirm-dialog__message">{message}</p> : null}
      {children}
    </ERPModal>
  );
}
