import React, { useRef } from "react";
import "./SearchField.css";
import { AppIcon } from "/src/components/Icon/Icon";
import { faSearch, faXmark } from "/src/icons/iconSet";

const joinClasses = (...values) => values.filter(Boolean).join(" ");

function SearchField({
  className = "",
  inputClassName = "",
  iconClassName = "",
  clearClassName = "",
  value = "",
  onChange,
  onClear,
  clearAriaLabel = "Clear search",
  inputRef = null,
  icon = faSearch,
  ...inputProps
}) {
  const localInputRef = useRef(null);
  const hasValue = String(value ?? "").length > 0;

  const assignInputRef = (node) => {
    localInputRef.current = node;
    if (!inputRef) return;
    if (typeof inputRef === "function") {
      inputRef(node);
      return;
    }
    inputRef.current = node;
  };

  const handleClear = () => {
    if (typeof onClear === "function") {
      onClear();
    }

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        localInputRef.current?.focus();
      });
      return;
    }

    localInputRef.current?.focus();
  };

  return (
    <div className={joinClasses("search-field", hasValue && "has-value", className)}>
      <span className={joinClasses("search-field__icon", iconClassName)} aria-hidden="true">
        <AppIcon icon={icon} />
      </span>
      <input
        {...inputProps}
        ref={assignInputRef}
        type={inputProps.type || "search"}
        value={value}
        onChange={onChange}
        className={joinClasses("search-field__input", inputClassName)}
      />
      {hasValue ? (
        <button
          type="button"
          className={joinClasses("search-field__clear", clearClassName)}
          onClick={handleClear}
          aria-label={clearAriaLabel}
        >
          <AppIcon icon={faXmark} />
        </button>
      ) : null}
    </div>
  );
}

export default SearchField;
