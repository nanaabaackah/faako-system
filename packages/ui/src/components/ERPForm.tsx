import {
  forwardRef,
  useId,
  type CSSProperties,
  type ChangeEventHandler,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const joinDescribedBy = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ") || undefined;

export type ERPFormTone = "info" | "success" | "warning" | "danger" | "error";

export function ERPForm({
  className = "",
  busy = false,
  children,
  "aria-busy": ariaBusy,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & {
  busy?: boolean;
}) {
  return (
    <form className={joinClasses("ui-erp-form", className)} aria-busy={ariaBusy ?? busy} {...props}>
      {children}
    </form>
  );
}

export function ERPFormSection({
  className = "",
  title,
  description = "",
  actions = null,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section className={joinClasses("ui-erp-form-section", className)} {...props}>
      {hasHeader ? (
        <div className="ui-erp-form-section__header">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="ui-erp-form-section__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ERPFormRow({
  className = "",
  columns = "auto",
  style,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  columns?: "auto" | 1 | 2 | 3 | 4;
}) {
  const columnStyle =
    typeof columns === "number"
      ? ({ "--ui-erp-form-row-columns": String(columns), ...style } as CSSProperties)
      : style;
  return (
    <div
      className={joinClasses(
        "ui-erp-form-row",
        columns === "auto" ? "ui-erp-form-row--auto" : null,
        className,
      )}
      style={columnStyle}
      {...props}
    >
      {children}
    </div>
  );
}

export function ERPFormActions({
  className = "",
  align = "end",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "end" | "between";
}) {
  return (
    <div className={joinClasses("ui-erp-form-actions", `ui-erp-form-actions--${align}`, className)} {...props}>
      {children}
    </div>
  );
}

export function ERPValidationMessage({
  className = "",
  tone = "error",
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & {
  tone?: "error" | "warning" | "info";
}) {
  return (
    <p
      className={joinClasses("ui-erp-validation-message", `ui-erp-validation-message--${tone}`, className)}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      {...props}
    >
      {children}
    </p>
  );
}

export function ERPFormNotice({
  className = "",
  tone = "info",
  title,
  onDismiss,
  dismissLabel = "Clear",
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  tone?: ERPFormTone;
  title?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const normalizedTone = tone === "error" ? "danger" : tone;
  const defaultRole = normalizedTone === "danger" || normalizedTone === "warning" ? "alert" : "status";
  return (
    <div
      className={joinClasses("ui-erp-form-notice", `ui-erp-form-notice--${normalizedTone}`, className)}
      role={props.role ?? defaultRole}
      {...props}
    >
      <span className="ui-erp-form-notice__content">
        {title ? <strong>{title}</strong> : null}
        {children ? <p>{children}</p> : null}
      </span>
      {onDismiss ? (
        <button
          type="button"
          className="ui-erp-form-notice__dismiss"
          onClick={onDismiss}
          aria-label={dismissLabel}
        >
          {dismissLabel}
        </button>
      ) : null}
    </div>
  );
}

type ERPFieldChromeProps = {
  label?: ReactNode;
  required?: boolean;
  helperText?: ReactNode;
  error?: ReactNode;
  labelClassName?: string;
  htmlFor?: string;
};

export function ERPFieldGroup({
  className = "",
  label,
  required = false,
  helperText = null,
  error = null,
  labelClassName = "",
  htmlFor,
  as = "label",
  children,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "children"> &
  ERPFieldChromeProps & {
    as?: "label" | "div";
    children?: ReactNode;
  }) {
  const Wrapper = as;
  return (
    <Wrapper
      className={joinClasses("ui-erp-field-group", error && "is-error", className)}
      {...(as === "label" && htmlFor ? { htmlFor } : {})}
      {...props}
    >
      {label ? (
        as === "div" && htmlFor ? (
          <label className={joinClasses("ui-erp-field__label", labelClassName)} htmlFor={htmlFor}>
            {label}
            {required ? (
              <span className="ui-erp-field__required" aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
        ) : (
          <span className={joinClasses("ui-erp-field__label", labelClassName)}>
            {label}
            {required ? (
              <span className="ui-erp-field__required" aria-hidden="true">
                *
              </span>
            ) : null}
          </span>
        )
      ) : null}
      {children}
      {error ? (
        <ERPValidationMessage className="ui-erp-field__message">{error}</ERPValidationMessage>
      ) : helperText ? (
        <p className="ui-erp-field__message">{helperText}</p>
      ) : null}
    </Wrapper>
  );
}

type ERPInputFieldProps = ERPFieldChromeProps & {
  fieldClassName?: string;
  inputClassName?: string;
};

export const ERPTextField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "children"> & ERPInputFieldProps
>(function ERPTextField(
  {
    className = "",
    fieldClassName = "",
    inputClassName = "",
    label,
    required = false,
    helperText = null,
    error = null,
    labelClassName = "",
    htmlFor,
    id,
    disabled = false,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || htmlFor || generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <ERPFieldGroup
      className={joinClasses(fieldClassName, className, disabled && "is-disabled")}
      label={label}
      required={required}
      helperText={helperText ? <span id={helperId}>{helperText}</span> : null}
      error={error ? <span id={errorId}>{error}</span> : null}
      labelClassName={labelClassName}
      htmlFor={fieldId}
      as="div"
    >
      <input
        ref={ref}
        id={fieldId}
        className={joinClasses("ui-erp-field__control", inputClassName)}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, helperId)}
        {...props}
      />
    </ERPFieldGroup>
  );
});

export const ERPDateField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "children" | "type"> & ERPInputFieldProps
>(function ERPDateField(props, ref) {
  return <ERPTextField ref={ref} type="date" {...props} />;
});

export const ERPTextareaField = forwardRef<
  HTMLTextAreaElement,
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "children"> &
    ERPInputFieldProps & {
      children?: never;
    }
>(function ERPTextareaField(
  {
    className = "",
    fieldClassName = "",
    inputClassName = "",
    label,
    required = false,
    helperText = null,
    error = null,
    labelClassName = "",
    htmlFor,
    id,
    disabled = false,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || htmlFor || generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <ERPFieldGroup
      className={joinClasses(fieldClassName, className, disabled && "is-disabled")}
      label={label}
      required={required}
      helperText={helperText ? <span id={helperId}>{helperText}</span> : null}
      error={error ? <span id={errorId}>{error}</span> : null}
      labelClassName={labelClassName}
      htmlFor={fieldId}
      as="div"
    >
      <textarea
        ref={ref}
        id={fieldId}
        className={joinClasses("ui-erp-field__control", "ui-erp-field__textarea", inputClassName)}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, helperId)}
        {...props}
      />
    </ERPFieldGroup>
  );
});

export type ERPSelectOption = {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
};

export const ERPSelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> &
    ERPInputFieldProps & {
      options?: ERPSelectOption[];
      placeholder?: ReactNode;
      selectClassName?: string;
    }
>(function ERPSelectField(
  {
    className = "",
    fieldClassName = "",
    inputClassName = "",
    selectClassName = "",
    label,
    required = false,
    helperText = null,
    error = null,
    labelClassName = "",
    htmlFor,
    id,
    disabled = false,
    options = [],
    placeholder,
    children,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || htmlFor || generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <ERPFieldGroup
      className={joinClasses(fieldClassName, className, disabled && "is-disabled")}
      label={label}
      required={required}
      helperText={helperText ? <span id={helperId}>{helperText}</span> : null}
      error={error ? <span id={errorId}>{error}</span> : null}
      labelClassName={labelClassName}
      htmlFor={fieldId}
      as="div"
    >
      <select
        ref={ref}
        id={fieldId}
        className={joinClasses("ui-erp-field__control", "ui-erp-field__select", inputClassName, selectClassName)}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, helperId)}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={String(option.value)} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
    </ERPFieldGroup>
  );
});

export const ERPSearchSelect = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "children" | "type" | "onChange"> &
    ERPInputFieldProps & {
      onChange?: ChangeEventHandler<HTMLInputElement>;
      results?: ReactNode;
      emptyMessage?: ReactNode;
    }
>(function ERPSearchSelect(
  {
    className = "",
    fieldClassName = "",
    inputClassName = "",
    label,
    required = false,
    helperText = null,
    error = null,
    labelClassName = "",
    htmlFor,
    id,
    disabled = false,
    results = null,
    emptyMessage = null,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || htmlFor || generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <ERPFieldGroup
      className={joinClasses(fieldClassName, className, disabled && "is-disabled")}
      label={label}
      required={required}
      helperText={helperText ? <span id={helperId}>{helperText}</span> : null}
      error={error ? <span id={errorId}>{error}</span> : null}
      labelClassName={labelClassName}
      htmlFor={fieldId}
      as="div"
    >
      <div className="ui-erp-search-select">
        <input
          ref={ref}
          id={fieldId}
          type="search"
          className={joinClasses("ui-erp-field__control", "ui-erp-search-select__input", inputClassName)}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinDescribedBy(ariaDescribedBy, errorId, helperId)}
          {...props}
        />
        {results ? (
          <div className="ui-erp-search-select__results">{results}</div>
        ) : emptyMessage ? (
          <p className="ui-erp-search-select__empty">{emptyMessage}</p>
        ) : null}
      </div>
    </ERPFieldGroup>
  );
});
