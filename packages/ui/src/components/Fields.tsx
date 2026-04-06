import {
  forwardRef,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import type { SelectOption } from "@faako/types";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const SearchGlyph = () => (
  <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
    <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const CloseGlyph = () => (
  <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
    <path d="M5.5 5.5L14.5 14.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M14.5 5.5L5.5 14.5" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

function FieldShell({
  label,
  hint = "",
  error = "",
  className = "",
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={joinClasses("ui-field", error && "is-error", className)}>
      {label ? <span className="ui-field__label">{label}</span> : null}
      {children}
      {error ? (
        <span className="ui-field__message ui-field__message--error">{error}</span>
      ) : hint ? (
        <span className="ui-field__message">{hint}</span>
      ) : null}
    </label>
  );
}

function FieldControl({
  className = "",
  prefix = null,
  suffix = null,
  children,
}: {
  className?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={joinClasses("ui-field__control", className)}>
      {prefix ? <span className="ui-field__prefix">{prefix}</span> : null}
      {children}
      {suffix ? <span className="ui-field__suffix">{suffix}</span> : null}
    </span>
  );
}

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label?: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    fieldClassName?: string;
    inputClassName?: string;
    prefix?: ReactNode;
    suffix?: ReactNode;
  }
>(function TextField(
  { label, hint, error, fieldClassName = "", inputClassName = "", prefix, suffix, ...props },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={fieldClassName}>
      <FieldControl prefix={prefix} suffix={suffix}>
        <input ref={ref} className={joinClasses("ui-field__input", inputClassName)} {...props} />
      </FieldControl>
    </FieldShell>
  );
});

export const TextareaField = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    fieldClassName?: string;
    inputClassName?: string;
  }
>(function TextareaField(
  { label, hint, error, fieldClassName = "", inputClassName = "", ...props },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={fieldClassName}>
      <FieldControl>
        <textarea ref={ref} className={joinClasses("ui-field__input ui-field__textarea", inputClassName)} {...props} />
      </FieldControl>
    </FieldShell>
  );
});

export const SelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & {
    label?: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    fieldClassName?: string;
    inputClassName?: string;
    options?: SelectOption[];
  }
>(function SelectField(
  { label, hint, error, fieldClassName = "", inputClassName = "", options = [], children, ...props },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={fieldClassName}>
      <FieldControl suffix={<span className="ui-field__caret">▾</span>}>
        <select ref={ref} className={joinClasses("ui-field__input ui-field__select", inputClassName)} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
          {children}
        </select>
      </FieldControl>
    </FieldShell>
  );
});

export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
    className?: string;
    inputClassName?: string;
    iconClassName?: string;
    clearClassName?: string;
    value?: string;
    onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
    onClear?: () => void;
    clearAriaLabel?: string;
    inputRef?: RefObject<HTMLInputElement | null> | ((node: HTMLInputElement | null) => void) | null;
    renderSearchIcon?: () => ReactNode;
    renderClearIcon?: () => ReactNode;
  }
>(function SearchField(
  {
    className = "",
    inputClassName = "",
    iconClassName = "",
    clearClassName = "",
    value = "",
    onChange,
    onClear,
    clearAriaLabel = "Clear search",
    inputRef = null,
    renderSearchIcon,
    renderClearIcon,
    ...inputProps
  },
  forwardedRef,
) {
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const hasValue = String(value ?? "").length > 0;

  const assignInputRef = (node: HTMLInputElement | null) => {
    localInputRef.current = node;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }

    if (!inputRef) return;
    if (typeof inputRef === "function") {
      inputRef(node);
      return;
    }
    inputRef.current = node;
  };

  const handleClear = () => {
    onClear?.();
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        localInputRef.current?.focus();
      });
      return;
    }
    localInputRef.current?.focus();
  };

  return (
    <div className={joinClasses("ui-search-field", hasValue && "has-value", className)}>
      <span className={joinClasses("ui-search-field__icon", iconClassName)} aria-hidden="true">
        {renderSearchIcon ? renderSearchIcon() : <SearchGlyph />}
      </span>
      <input
        {...inputProps}
        ref={assignInputRef}
        type={inputProps.type || "search"}
        value={value}
        onChange={onChange}
        className={joinClasses("ui-search-field__input", inputClassName)}
      />
      {hasValue ? (
        <button
          type="button"
          className={joinClasses("ui-search-field__clear", clearClassName)}
          onClick={handleClear}
          aria-label={clearAriaLabel}
        >
          {renderClearIcon ? renderClearIcon() : <CloseGlyph />}
        </button>
      ) : null}
    </div>
  );
});
