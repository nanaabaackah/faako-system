import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

export type ComboboxOption<T = unknown> = {
  value: string;
  label: string;
  description?: string;
  data?: T;
  disabled?: boolean;
};

export function ComboboxField<T = unknown>({
  label,
  value,
  options,
  placeholder = "Search or type a value",
  hint,
  error,
  loading = false,
  emptyMessage = "No matching options.",
  createLabel = (typed) => `Create client “${typed}”`,
  onInputChange,
  onSelect,
  onCreate,
}: {
  label?: ReactNode;
  value: string;
  options: ComboboxOption<T>[];
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  createLabel?: (typed: string) => string;
  onInputChange: (value: string) => void;
  onSelect: (option: ComboboxOption<T>) => void;
  onCreate?: (typed: string) => void;
}) {
  const id = useId();
  const listId = `${id}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const typed = value.trim();
  const selectable = useMemo(() => [
    ...options.filter((option) => !option.disabled).map((option) => ({ type: "option" as const, option })),
    ...(onCreate && typed && !options.some((option) => option.label.toLocaleLowerCase() === typed.toLocaleLowerCase())
      ? [{ type: "create" as const, typed }]
      : []),
  ], [onCreate, options, typed]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => setActiveIndex(0), [value, options.length]);

  const commit = (index: number) => {
    const entry = selectable[index];
    if (!entry) return;
    if (entry.type === "option") onSelect(entry.option);
    else onCreate?.(entry.typed);
    setOpen(false);
  };

  return (
    <div className={`ui-combobox-field${error ? " is-error" : ""}`} ref={rootRef}>
      {label ? <label className="ui-field__label" htmlFor={id}>{label}</label> : null}
      <div className="ui-combobox-field__control">
        <span aria-hidden="true" className="ui-combobox-field__search">⌕</span>
        <input
          id={id}
          className="ui-combobox-field__input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && selectable[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
          value={value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => { onInputChange(event.target.value); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((current) => Math.min(current + 1, Math.max(selectable.length - 1, 0))); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => Math.max(current - 1, 0)); }
            if (event.key === "Enter" && open && selectable.length) { event.preventDefault(); commit(activeIndex); }
            if (event.key === "Escape") setOpen(false);
          }}
        />
        {loading ? <span className="ui-combobox-field__loading" aria-label="Loading">•••</span> : <span aria-hidden="true">▾</span>}
      </div>
      {open ? (
        <div className="ui-combobox-field__popover" id={listId} role="listbox">
          {options.map((option) => {
            const index = selectable.findIndex((entry) => entry.type === "option" && entry.option.value === option.value);
            return <button key={option.value} id={index >= 0 ? `${id}-option-${index}` : undefined} type="button" role="option" aria-selected={index === activeIndex} disabled={option.disabled} className={`ui-combobox-field__option${index === activeIndex ? " is-active" : ""}`} onMouseEnter={() => index >= 0 && setActiveIndex(index)} onClick={() => onSelect(option)}><strong>{option.label}</strong>{option.description ? <span>{option.description}</span> : null}</button>;
          })}
          {!loading && !options.length ? <p className="ui-combobox-field__empty">{emptyMessage}</p> : null}
          {onCreate && typed && selectable.some((entry) => entry.type === "create") ? <button id={`${id}-option-${selectable.length - 1}`} type="button" role="option" aria-selected={activeIndex === selectable.length - 1} className={`ui-combobox-field__option is-create${activeIndex === selectable.length - 1 ? " is-active" : ""}`} onMouseEnter={() => setActiveIndex(selectable.length - 1)} onClick={() => { onCreate(typed); setOpen(false); }}>+ {createLabel(typed)}</button> : null}
        </div>
      ) : null}
      {error ? <span className="ui-field__message ui-field__message--error">{error}</span> : hint ? <span className="ui-field__message">{hint}</span> : null}
    </div>
  );
}
