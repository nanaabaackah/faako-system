import SearchField from "../../../components/SearchField/SearchField";

export default function WaterCustomerPicker({
  value,
  onChange,
  onClear,
  onFocus,
  onBlur,
  onKeyDown,
  placeholder,
  ariaLabel,
  menuOpen,
  options,
  selectedCustomerId,
  onSelectCustomer,
  typedCustomerName,
  matchedTypedCustomer,
  onCreateCustomer,
  selectedCustomer,
  directoryError = "",
  showDirectoryError = false,
  required = false,
}) {
  return (
    <div className="water-module-customer-picker water-order-customer-picker">
      <SearchField
        value={value}
        onChange={onChange}
        onClear={onClear}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        inputClassName="water-order-customer-search"
        required={required}
      />
      {menuOpen ? (
        options.length || typedCustomerName ? (
          <div className="water-module-customer-options" role="listbox" aria-label="Customer directory">
            {options.map((customer) => {
              const isActive = String(customer.id) === String(selectedCustomerId);
              return (
                <button
                  key={customer.id}
                  type="button"
                  className={`water-module-customer-option ${isActive ? "is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelectCustomer(String(customer.id))}
                >
                  <span>{customer.name}</span>
                  <small>{customer.phone ? customer.phone : `#${customer.id}`}</small>
                </button>
              );
            })}
            {typedCustomerName && !matchedTypedCustomer ? (
              <button
                type="button"
                className="water-module-customer-option water-order-customer-option--create"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onCreateCustomer}
              >
                <span>Create "{typedCustomerName}"</span>
                <small>Press Enter</small>
              </button>
            ) : null}
          </div>
        ) : null
      ) : null}
      {selectedCustomer ? (
        <p className="water-module-inline-note">
          REEBS #{selectedCustomer.id}
          {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}
        </p>
      ) : typedCustomerName && !matchedTypedCustomer ? (
        <p className="water-module-inline-note">New customer on save.</p>
      ) : null}
      {directoryError && showDirectoryError ? (
        <p className="water-module-inline-note">{directoryError}</p>
      ) : null}
    </div>
  );
}
