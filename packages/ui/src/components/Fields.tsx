import {
  Children,
  type CSSProperties,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import type { SelectOption } from "@faako/types";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const joinDescribedBy = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ") || undefined;

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

const CalendarGlyph = () => (
  <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
    <rect x="3" y="4.5" width="14" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 2.75V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M14 2.75V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3.75 8.25H16.25" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const ChevronGlyph = ({ direction }: { direction: "left" | "right" }) => (
  <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
    {direction === "left" ? (
      <path d="M12.5 4.5L7 10L12.5 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <path d="M7.5 4.5L13 10L7.5 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    )}
  </svg>
);

const CALENDAR_WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const calendarMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});
const calendarValueFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const monthValueFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});
const shortMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
});

type OptionChildProps = {
  value?: string | number;
  children?: ReactNode;
  disabled?: boolean;
};

const parseDateValue = (value?: string | number | null) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseMonthValue = (value?: string | number | null) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const [, year, month] = match;
  const parsed = new Date(Number(year), Number(month) - 1, 1);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatMonthValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const formatTimeLabel = (value: string) => {
  const [hoursValue, minutesValue] = value.split(":");
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
};

const buildTimeOptions = (intervalMinutes = 15) => {
  const safeInterval =
    Number.isInteger(intervalMinutes) && intervalMinutes > 0 && intervalMinutes <= 60
      ? intervalMinutes
      : 15;
  return Array.from({ length: Math.ceil((24 * 60) / safeInterval) }, (_, index) => {
    const minutesFromMidnight = index * safeInterval;
    const hours = Math.floor(minutesFromMidnight / 60);
    const minutes = minutesFromMidnight % 60;
    const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    return { value, label: formatTimeLabel(value) };
  });
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const isSameDay = (left: Date | null, right: Date | null) => {
  if (!left || !right) return false;
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};
const getWeekStartOffset = (date: Date) => (date.getDay() + 6) % 7;

const buildCalendarDays = (month: Date) => {
  const monthStart = startOfMonth(month);
  const start = new Date(monthStart);
  start.setDate(monthStart.getDate() - getWeekStartOffset(monthStart));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
};

const buildOptionsFromChildren = (children: ReactNode): SelectOption[] =>
  Children.toArray(children)
    .map((child) => {
      if (!isValidElement<OptionChildProps>(child)) return null;
      if (typeof child.type !== "string" || child.type.toLowerCase() !== "option") return null;
      const value = child.props.value ?? "";
      const label =
        typeof child.props.children === "string"
          ? child.props.children
          : Children.toArray(child.props.children).join("");
      return {
        value: String(value),
        label,
        disabled: Boolean(child.props.disabled),
      } satisfies SelectOption;
    })
    .filter(Boolean) as SelectOption[];

function FieldShell({
  label,
  hint = "",
  error = "",
  required = false,
  className = "",
  as = "label",
  htmlFor,
  hintId,
  errorId,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  as?: "label" | "div";
  htmlFor?: string;
  hintId?: string;
  errorId?: string;
  children: ReactNode;
}) {
  const Wrapper = as;
  return (
    <Wrapper
      className={joinClasses("ui-field", Boolean(error) && "is-error", className)}
      {...(as === "label" && htmlFor ? { htmlFor } : {})}
    >
      {label ? (
        as === "div" && htmlFor ? (
          <label className="ui-field__label" htmlFor={htmlFor}>
            {label}
            {required ? (
              <>
                <span className="ui-field__required" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">required</span>
              </>
            ) : null}
          </label>
        ) : (
          <span className="ui-field__label">
            {label}
            {required ? (
              <>
                <span className="ui-field__required" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">required</span>
              </>
            ) : null}
          </span>
        )
      ) : null}
      {children}
      {error ? (
        <span className="ui-field__message ui-field__message--error" id={errorId}>
          {error}
        </span>
      ) : hint ? (
        <span className="ui-field__message" id={hintId}>
          {hint}
        </span>
      ) : null}
    </Wrapper>
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
  {
    label,
    hint,
    error,
    fieldClassName = "",
    inputClassName = "",
    prefix,
    suffix,
    id,
    required,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={Boolean(required)}
      htmlFor={fieldId}
      hintId={hintId}
      errorId={errorId}
      className={fieldClassName}
    >
      <FieldControl prefix={prefix} suffix={suffix}>
        <input
          ref={ref}
          id={fieldId}
          className={joinClasses("ui-field__input", inputClassName)}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, hintId)}
          {...props}
        />
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
  {
    label,
    hint,
    error,
    fieldClassName = "",
    inputClassName = "",
    id,
    required,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={Boolean(required)}
      htmlFor={fieldId}
      hintId={hintId}
      errorId={errorId}
      className={fieldClassName}
    >
      <FieldControl>
        <textarea
          ref={ref}
          id={fieldId}
          className={joinClasses("ui-field__input ui-field__textarea", inputClassName)}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, hintId)}
          {...props}
        />
      </FieldControl>
    </FieldShell>
  );
});

export const SelectField = forwardRef<
  HTMLSelectElement,
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
    label?: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    fieldClassName?: string;
    inputClassName?: string;
    options?: SelectOption[];
    placeholder?: string;
    onChangeValue?: (nextValue: string | string[]) => void;
    onChange?: (event: {
      target: { value: string | string[] };
      currentTarget: { value: string | string[] };
    }) => void;
    ariaLabel?: string;
  }
>(function SelectField(
  {
    label,
    hint,
    error,
    fieldClassName = "",
    inputClassName = "",
    options = [],
    children,
    placeholder = "Select option",
    onChangeValue,
    onChange,
    value = "",
    disabled = false,
    multiple = false,
    name,
    required = false,
    ariaLabel,
    id,
    "aria-describedby": ariaDescribedBy,
    className = "",
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const triggerId = `${fieldId}-trigger`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const inputRef = useRef<HTMLSelectElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openFocusDirectionRef = useRef<"first" | "last" | "selected">("selected");
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const resolvedOptions = useMemo(
    () => (options.length ? options : buildOptionsFromChildren(children)),
    [children, options],
  );
  const hasEmptyValueOption = useMemo(
    () => resolvedOptions.some((option) => String(option.value) === ""),
    [resolvedOptions],
  );
  const selectedValues = useMemo(() => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    if (value === undefined || value === null) {
      return [];
    }
    const normalizedValue = String(value);
    if (normalizedValue === "" && !hasEmptyValueOption) {
      return [];
    }
    return [normalizedValue];
  }, [hasEmptyValueOption, value]);
  const selectedValue = selectedValues[0] || "";
  const selectedOptions = useMemo(
    () => resolvedOptions.filter((option) => selectedValues.includes(String(option.value))),
    [resolvedOptions, selectedValues],
  );
  const selectedOption = selectedOptions[0] || null;

  const assignInputRef = (node: HTMLSelectElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const updatePanelPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const targetWidth = Math.max(rect.width, 220);
    const width = Math.min(targetWidth, viewportWidth - 16);
    let left = rect.left;
    if (left + width > viewportWidth - 8) {
      left = viewportWidth - width - 8;
    }
    left = Math.max(8, left);
    const estimatedHeight = Math.min(320, 56 + resolvedOptions.length * 46);
    const belowTop = rect.bottom + 8;
    const aboveTop = rect.top - estimatedHeight - 8;
    const top = belowTop + estimatedHeight <= viewportHeight || aboveTop < 8 ? belowTop : aboveTop;
    setPanelStyle({
      position: "fixed",
      top,
      left,
      width,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const focusFrame = window.requestAnimationFrame(() => {
      const optionButtons = Array.from(
        panelRef.current?.querySelectorAll<HTMLButtonElement>(
          'button[role="option"]:not(:disabled)',
        ) || [],
      );
      if (!optionButtons.length) return;
      const selectedButton = optionButtons.find(
        (button) => button.getAttribute("aria-selected") === "true",
      );
      const target = openFocusDirectionRef.current === "last"
        ? optionButtons[optionButtons.length - 1]
        : openFocusDirectionRef.current === "first"
          ? optionButtons[0]
          : selectedButton || optionButtons[0];
      target?.focus();
      openFocusDirectionRef.current = "selected";
    });
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleViewportChange = () => updatePanelPosition();
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [open, resolvedOptions.length]);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, multiple, selectedValue, selectedValues]);

  const applyValue = (nextValue: string | string[]) => {
    onChangeValue?.(nextValue);
    onChange?.({
      target: { value: nextValue },
      currentTarget: { value: nextValue },
    });
    if (!multiple) {
      setOpen(false);
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
        return;
      }
      triggerRef.current?.focus();
    }
  };

  const handleOptionSelect = (nextValue: string) => {
    if (!multiple) {
      applyValue(nextValue);
      return;
    }
    const nextValues = selectedValues.includes(nextValue)
      ? selectedValues.filter((item) => item !== nextValue)
      : [...selectedValues, nextValue];
    applyValue(nextValues);
  };

  const displayValue = multiple
    ? selectedOptions.length
      ? selectedOptions.map((option) => option.label).join(", ")
      : placeholder
    : selectedOption?.label || placeholder;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={triggerId}
      hintId={hintId}
      errorId={errorId}
      as="div"
      className={joinClasses(fieldClassName, className, "ui-dropdown-field", open && "is-open")}
    >
      <div className="ui-dropdown-field__shell">
        <select
          ref={assignInputRef}
          id={fieldId}
          name={name}
          value={multiple ? selectedValues : selectedValue}
          multiple={multiple}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, hintId)}
          tabIndex={-1}
          aria-hidden="true"
          className="ui-dropdown-field__native"
          onChange={() => {}}
        >
          {resolvedOptions.map((option) => (
            <option key={option.value} value={String(option.value)} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className={joinClasses(
            "ui-dropdown-field__trigger",
            !selectedOption && "is-placeholder",
            className,
            inputClassName,
          )}
          onClick={() => {
            if (disabled) return;
            openFocusDirectionRef.current = "selected";
            setOpen((current) => !current);
          }}
          onKeyDown={(event) => {
            if (disabled || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
            event.preventDefault();
            openFocusDirectionRef.current = event.key === "ArrowUp" ? "last" : "first";
            setOpen(true);
          }}
          aria-label={ariaLabel || (typeof label === "string" ? label : "Select option")}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, hintId)}
          disabled={disabled}
        >
          <span className="ui-dropdown-field__value">
            {displayValue}
          </span>
          <span className="ui-dropdown-field__caret" aria-hidden="true">▾</span>
        </button>
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="ui-dropdown-field__popover"
              style={panelStyle}
              role="listbox"
              aria-multiselectable={multiple || undefined}
              aria-label={ariaLabel || "Options"}
              onKeyDown={(event) => {
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                const optionButtons = Array.from(
                  panelRef.current?.querySelectorAll<HTMLButtonElement>(
                    'button[role="option"]:not(:disabled)',
                  ) || [],
                );
                if (!optionButtons.length) return;
                event.preventDefault();
                const currentIndex = optionButtons.findIndex(
                  (button) => button === document.activeElement,
                );
                let nextIndex = currentIndex;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = optionButtons.length - 1;
                if (event.key === "ArrowDown") {
                  nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % optionButtons.length;
                }
                if (event.key === "ArrowUp") {
                  nextIndex = currentIndex <= 0 ? optionButtons.length - 1 : currentIndex - 1;
                }
                optionButtons[nextIndex]?.focus();
              }}
            >
              <div className="ui-dropdown-field__list">
                {resolvedOptions.map((option) => {
                  const isSelected = selectedValues.includes(String(option.value));
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      className={joinClasses(
                        "ui-dropdown-field__option",
                        isSelected && "is-selected",
                        option.disabled && "is-disabled",
                      )}
                      onClick={() => handleOptionSelect(String(option.value))}
                      disabled={disabled || option.disabled}
                      aria-selected={isSelected}
                    >
                      <span>{option.label}</span>
                      {multiple && isSelected ? (
                        <span className="ui-dropdown-field__option-mark" aria-hidden="true">✓</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {multiple ? (
                <div className="ui-dropdown-field__footer">
                  <span className="ui-dropdown-field__footer-copy">
                    {selectedValues.length
                      ? `${selectedValues.length} selected`
                      : "No selections"}
                  </span>
                  <button
                    type="button"
                    className="ui-dropdown-field__footer-action"
                    onClick={() => {
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </FieldShell>
  );
});

export const DateField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
    label?: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    fieldClassName?: string;
    inputClassName?: string;
    value?: string;
    onChangeValue?: (nextValue: string) => void;
    onChange?: (event: { target: { value: string }; currentTarget: { value: string } }) => void;
    placeholder?: string;
    clearable?: boolean;
    ariaLabel?: string;
    isDateDisabled?: (date: Date) => boolean;
  }
>(function DateField(
  {
    label,
    hint,
    error,
    fieldClassName = "",
    inputClassName = "",
    value = "",
    onChangeValue,
    onChange,
    placeholder = "Select date",
    disabled = false,
    required = false,
    name,
    min,
    max,
    clearable = true,
    ariaLabel,
    isDateDisabled,
    id,
    className = "",
    onBlur,
    "aria-describedby": ariaDescribedBy,
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const triggerId = `${fieldId}-trigger`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const minDate = useMemo(() => parseDateValue(min), [min]);
  const maxDate = useMemo(() => parseDateValue(max), [max]);
  const today = useMemo(() => startOfDay(new Date()), []);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate || today));
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const assignInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const updatePanelPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const targetWidth = Math.max(rect.width, 320);
    const width = Math.min(targetWidth, viewportWidth - 16);
    let left = rect.left;
    if (left + width > viewportWidth - 8) {
      left = viewportWidth - width - 8;
    }
    left = Math.max(8, left);
    const estimatedHeight = 356;
    const belowTop = rect.bottom + 8;
    const aboveTop = rect.top - estimatedHeight - 8;
    const top = belowTop + estimatedHeight <= viewportHeight || aboveTop < 8 ? belowTop : aboveTop;
    setPanelStyle({
      position: "fixed",
      top,
      left,
      width,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleViewportChange = () => updatePanelPosition();
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, value]);

  useEffect(() => {
    if (!selectedDate) return;
    setViewMonth(startOfMonth(selectedDate));
  }, [value, selectedDate]);

  const displayValue = selectedDate ? calendarValueFormatter.format(selectedDate) : "";
  const calendarDays = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);
  const minTime = minDate ? startOfDay(minDate).getTime() : null;
  const maxTime = maxDate ? startOfDay(maxDate).getTime() : null;

  const isDayDisabled = (date: Date) => {
    const time = startOfDay(date).getTime();
    if (minTime !== null && time < minTime) return true;
    if (maxTime !== null && time > maxTime) return true;
    if (isDateDisabled?.(date)) return true;
    return false;
  };

  const applyValue = (nextDate: Date | null) => {
    const nextValue = nextDate ? formatDateValue(nextDate) : "";
    onChangeValue?.(nextValue);
    onChange?.({
      target: { value: nextValue },
      currentTarget: { value: nextValue },
    });
    setOpen(false);
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
      return;
    }
    triggerRef.current?.focus();
  };

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={triggerId}
      hintId={hintId}
      errorId={errorId}
      as="div"
      className={joinClasses(fieldClassName, className, "ui-date-field", open && "is-open")}
    >
      <div className="ui-date-field__shell">
        <input
          ref={assignInputRef}
          id={fieldId}
          type="date"
          name={name}
          value={value}
          min={min}
          max={max}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, hintId)}
          tabIndex={-1}
          aria-hidden="true"
          className="ui-date-field__native"
          onChange={() => {}}
          onBlur={onBlur}
          readOnly
        />
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className={joinClasses(
            "ui-date-field__trigger",
            !displayValue && "is-placeholder",
            className,
            inputClassName,
          )}
          onClick={() => {
            if (disabled) return;
            setOpen((current) => !current);
          }}
          aria-label={ariaLabel || (typeof label === "string" ? label : "Select date")}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, hintId)}
          disabled={disabled}
        >
          <span className="ui-date-field__value">{displayValue || placeholder}</span>
          <span className="ui-date-field__icon" aria-hidden="true">
            <CalendarGlyph />
          </span>
        </button>
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="ui-date-field__popover"
              style={panelStyle}
              role="dialog"
              aria-modal="false"
              aria-label={ariaLabel || "Choose date"}
            >
              <div className="ui-date-field__header">
                <button
                  type="button"
                  className="ui-date-field__nav"
                  onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  aria-label="Previous month"
                >
                  <ChevronGlyph direction="left" />
                </button>
                <strong className="ui-date-field__title">{calendarMonthFormatter.format(viewMonth)}</strong>
                <button
                  type="button"
                  className="ui-date-field__nav"
                  onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  aria-label="Next month"
                >
                  <ChevronGlyph direction="right" />
                </button>
              </div>

              <div className="ui-date-field__weekdays" aria-hidden="true">
                {CALENDAR_WEEKDAY_LABELS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="ui-date-field__grid">
                {calendarDays.map(({ date, isCurrentMonth }) => {
                  const isSelected = isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, today);
                  const isDisabled = isDayDisabled(date);
                  return (
                    <button
                      key={formatDateValue(date)}
                      type="button"
                      className={joinClasses(
                        "ui-date-field__day",
                        !isCurrentMonth && "is-outside",
                        isSelected && "is-selected",
                        isToday && "is-today",
                        isDisabled && "is-disabled",
                      )}
                      onClick={() => applyValue(date)}
                      disabled={isDisabled}
                      aria-pressed={isSelected}
                      aria-current={isToday ? "date" : undefined}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="ui-date-field__footer">
                <button
                  type="button"
                  className="ui-date-field__action"
                  onClick={() => applyValue(today)}
                  disabled={isDayDisabled(today)}
                >
                  Today
                </button>
                {clearable ? (
                  <button
                    type="button"
                    className="ui-date-field__action"
                    onClick={() => applyValue(null)}
                    disabled={!value}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </FieldShell>
  );
});

export const MonthField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
    label?: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    fieldClassName?: string;
    inputClassName?: string;
    value?: string;
    onChangeValue?: (nextValue: string) => void;
    onChange?: (event: { target: { value: string }; currentTarget: { value: string } }) => void;
    placeholder?: string;
    clearable?: boolean;
    ariaLabel?: string;
  }
>(function MonthField(
  {
    label,
    hint,
    error,
    fieldClassName = "",
    inputClassName = "",
    value = "",
    onChangeValue,
    onChange,
    placeholder = "Select month",
    disabled = false,
    required = false,
    name,
    min,
    max,
    clearable = true,
    ariaLabel,
    id,
    className = "",
    onBlur,
    "aria-describedby": ariaDescribedBy,
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const triggerId = `${fieldId}-trigger`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const selectedMonth = useMemo(() => parseMonthValue(value), [value]);
  const minMonth = useMemo(() => parseMonthValue(min), [min]);
  const maxMonth = useMemo(() => parseMonthValue(max), [max]);
  const today = useMemo(() => startOfMonth(new Date()), []);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => (selectedMonth || today).getFullYear());
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, month) => new Date(viewYear, month, 1)),
    [viewYear],
  );

  const assignInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const updatePanelPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const targetWidth = Math.max(rect.width, 286);
    const width = Math.min(targetWidth, viewportWidth - 16);
    let left = rect.left;
    if (left + width > viewportWidth - 8) {
      left = viewportWidth - width - 8;
    }
    left = Math.max(8, left);
    const estimatedHeight = 246;
    const belowTop = rect.bottom + 8;
    const aboveTop = rect.top - estimatedHeight - 8;
    const top = belowTop + estimatedHeight <= viewportHeight || aboveTop < 8 ? belowTop : aboveTop;
    setPanelStyle({
      position: "fixed",
      top,
      left,
      width,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleViewportChange = () => updatePanelPosition();
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (!selectedMonth) return;
    setViewYear(selectedMonth.getFullYear());
  }, [selectedMonth]);

  const minTime = minMonth?.getTime() ?? null;
  const maxTime = maxMonth?.getTime() ?? null;
  const displayValue = selectedMonth ? monthValueFormatter.format(selectedMonth) : "";
  const applyValue = (nextMonth: Date | null) => {
    const nextValue = nextMonth ? formatMonthValue(nextMonth) : "";
    onChangeValue?.(nextValue);
    onChange?.({
      target: { value: nextValue },
      currentTarget: { value: nextValue },
    });
    setOpen(false);
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
      return;
    }
    triggerRef.current?.focus();
  };

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={triggerId}
      hintId={hintId}
      errorId={errorId}
      as="div"
      className={joinClasses(fieldClassName, className, "ui-date-field", "ui-month-field", open && "is-open")}
    >
      <div className="ui-date-field__shell">
        <input
          ref={assignInputRef}
          id={fieldId}
          type="month"
          name={name}
          value={value}
          min={min}
          max={max}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, hintId)}
          tabIndex={-1}
          aria-hidden="true"
          className="ui-date-field__native"
          onChange={() => {}}
          onBlur={onBlur}
          readOnly
        />
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className={joinClasses(
            "ui-date-field__trigger",
            !displayValue && "is-placeholder",
            className,
            inputClassName,
          )}
          onClick={() => {
            if (disabled) return;
            setOpen((current) => !current);
          }}
          aria-label={ariaLabel || (typeof label === "string" ? label : "Select month")}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, hintId)}
          disabled={disabled}
        >
          <span className="ui-date-field__value">{displayValue || placeholder}</span>
          <span className="ui-date-field__icon" aria-hidden="true">
            <CalendarGlyph />
          </span>
        </button>
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="ui-date-field__popover ui-month-field__popover"
              style={panelStyle}
              role="dialog"
              aria-modal="false"
              aria-label={ariaLabel || "Choose month"}
            >
              <div className="ui-date-field__header">
                <button
                  type="button"
                  className="ui-date-field__nav"
                  onClick={() => setViewYear((current) => current - 1)}
                  aria-label="Previous year"
                >
                  <ChevronGlyph direction="left" />
                </button>
                <strong className="ui-date-field__title">{viewYear}</strong>
                <button
                  type="button"
                  className="ui-date-field__nav"
                  onClick={() => setViewYear((current) => current + 1)}
                  aria-label="Next year"
                >
                  <ChevronGlyph direction="right" />
                </button>
              </div>

              <div className="ui-month-field__grid">
                {months.map((month) => {
                  const monthTime = month.getTime();
                  const isSelected = selectedMonth?.getTime() === monthTime;
                  const isCurrent = today.getTime() === monthTime;
                  const isDisabled =
                    (minTime !== null && monthTime < minTime) ||
                    (maxTime !== null && monthTime > maxTime);
                  return (
                    <button
                      key={formatMonthValue(month)}
                      type="button"
                      className={joinClasses(
                        "ui-date-field__day",
                        "ui-month-field__option",
                        isSelected && "is-selected",
                        isCurrent && "is-today",
                        isDisabled && "is-disabled",
                      )}
                      onClick={() => applyValue(month)}
                      disabled={isDisabled}
                      aria-pressed={isSelected}
                    >
                      {shortMonthFormatter.format(month)}
                    </button>
                  );
                })}
              </div>

              <div className="ui-date-field__footer">
                <button type="button" className="ui-date-field__action" onClick={() => applyValue(today)}>
                  This month
                </button>
                {clearable ? (
                  <button
                    type="button"
                    className="ui-date-field__action"
                    onClick={() => applyValue(null)}
                    disabled={!value}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </FieldShell>
  );
});

export const TimeField = forwardRef<
  HTMLSelectElement,
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
    label?: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    fieldClassName?: string;
    inputClassName?: string;
    options?: SelectOption[];
    placeholder?: string;
    intervalMinutes?: number;
    onChangeValue?: (nextValue: string | string[]) => void;
    onChange?: (event: {
      target: { value: string | string[] };
      currentTarget: { value: string | string[] };
    }) => void;
    ariaLabel?: string;
  }
>(function TimeField({ options = [], intervalMinutes = 15, value = "", ...props }, ref) {
  const normalizedValue = Array.isArray(value) ? String(value[0] || "") : String(value || "");
  const timeOptions = useMemo(() => {
    const generatedOptions = options.length ? options : buildTimeOptions(intervalMinutes);
    if (!normalizedValue || generatedOptions.some((option) => String(option.value) === normalizedValue)) {
      return generatedOptions;
    }
    return [{ value: normalizedValue, label: formatTimeLabel(normalizedValue) }, ...generatedOptions];
  }, [intervalMinutes, normalizedValue, options]);

  return <SelectField ref={ref} {...props} value={normalizedValue} options={timeOptions} />;
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
