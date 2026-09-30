import React from "react";
import SearchField from "../../../components/SearchField/SearchField";

function BookingCustomerPicker({
  value,
  onChange,
  onClear,
  onFocus,
  onBlur,
  onKeyDown,
  menuOpen,
  options,
  selectedCustomerId,
  onSelectCustomer,
  typedCustomerName,
  matchedTypedCustomer,
  onCreateCustomer,
  createBusy = false,
  disabled = false,
  directoryError = "",
}) {
  return (
    <div className="bookings-customer-picker">
      <SearchField
        value={value}
        onChange={onChange}
        onClear={onClear}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder="Search or add customer"
        aria-label="Search or add customer"
        disabled={disabled}
        required
      />
      {menuOpen ? (
        options.length || typedCustomerName ? (
          <div className="bookings-customer-options" role="listbox" aria-label="Customer directory">
            {options.map((customer) => {
              const isActive = String(customer.id) === String(selectedCustomerId);
              return (
                <button
                  key={customer.id}
                  type="button"
                  className={`bookings-customer-option${isActive ? " is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelectCustomer(String(customer.id))}
                  disabled={disabled}
                >
                  <span>{customer.name}</span>
                  <small>{customer.phone ? customer.phone : `#${customer.id}`}</small>
                </button>
              );
            })}
            {typedCustomerName && !matchedTypedCustomer ? (
              <button
                type="button"
                className="bookings-customer-option bookings-customer-option--create"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onCreateCustomer}
                disabled={disabled || createBusy}
              >
                <span>{createBusy ? `Creating "${typedCustomerName}"...` : `Create "${typedCustomerName}"`}</span>
                <small>{createBusy ? "Please wait" : "Press Enter"}</small>
              </button>
            ) : null}
          </div>
        ) : null
      ) : null}
      {typedCustomerName && !matchedTypedCustomer ? (
        <p className="bookings-inline-note">New customer will be created on save.</p>
      ) : null}
      {directoryError ? <p className="bookings-inline-note">{directoryError}</p> : null}
    </div>
  );
}

export default React.memo(BookingCustomerPicker);
