import React, { useRef } from "react";
import { SearchField as SharedSearchField } from "@faako/ui";
import "./SearchField.css";
import { AppIcon } from "/src/components/Icon/Icon";
import { faSearch, faXmark } from "/src/icons/iconSet";

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
    <SharedSearchField
      {...inputProps}
      inputRef={assignInputRef}
      value={value}
      onChange={onChange}
      onClear={handleClear}
      clearAriaLabel={clearAriaLabel}
      className={`search-field${hasValue ? " has-value" : ""}${className ? ` ${className}` : ""}`}
      inputClassName={`search-field__input${inputClassName ? ` ${inputClassName}` : ""}`}
      iconClassName={`search-field__icon${iconClassName ? ` ${iconClassName}` : ""}`}
      clearClassName={`search-field__clear${clearClassName ? ` ${clearClassName}` : ""}`}
      renderSearchIcon={() => <AppIcon icon={icon} />}
      renderClearIcon={() => <AppIcon icon={faXmark} />}
    />
  );
}

export default SearchField;
