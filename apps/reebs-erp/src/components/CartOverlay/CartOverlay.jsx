import React, { useEffect, useMemo, useRef } from "react";
import "./CartOverlay.css";
import { Link, useLocation } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import { faMinus, faPlus, faShoppingCart, faTimes, faTrash } from "/src/icons/iconSet";
import { useCart } from "../CartContext/CartContext";
import {
  getCatalogItemBackgroundStyle,
  getCatalogItemDisplayName,
  getCatalogItemImage,
} from "/src/utils/itemMediaBackgrounds";
import {
  getCartItemBillingQuantity,
  getCartItemCategory,
  getCartItemKey,
  getCartItemLineTotal,
  getCartItemMaxSelectableQuantity,
  getCartItemPrice,
  getCartItemQuantity,
  getCartItemRateLabel,
  isCartItemStockTracked,
  splitCartItems,
} from "/src/utils/cart";

const CART_SECTION_CONFIG = {
  rentals: {
    title: "Rental items",
    note: "Rental timing and availability are confirmed with your booking.",
  },
  shop: {
    title: "Shop items",
    note: "Shop items stay separate from rentals for pickup and packing.",
  },
};

function CartOverlay({ open, onClose }) {
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const {
    cart,
    cartOpen,
    closeCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    convertPrice,
    formatCurrency,
  } = useCart();
  const isOpen = typeof open === "boolean" ? open : cartOpen;
  const handleClose = onClose || closeCart;
  const cartGroups = useMemo(() => splitCartItems(cart), [cart]);
  const cartSections = useMemo(
    () =>
      [
        { key: "rentals", items: cartGroups.rentals },
        { key: "shop", items: cartGroups.shop },
      ].filter((section) => section.items.length),
    [cartGroups]
  );
  const itemCount = cart.reduce((acc, item) => acc + getCartItemBillingQuantity(item), 0);
  const rentalCount = cartGroups.rentals.reduce((acc, item) => acc + getCartItemBillingQuantity(item), 0);
  const shopCount = cartGroups.shop.reduce((acc, item) => acc + getCartItemBillingQuantity(item), 0);
  const subtotal = cart.reduce((acc, item) => acc + getCartItemLineTotal(item), 0);
  const subtotalLabel = formatCurrency(convertPrice(subtotal));

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose, isOpen]);

  useEffect(() => {
    if (location.pathname !== previousPathRef.current && isOpen) {
      handleClose();
    }
    previousPathRef.current = location.pathname;
  }, [handleClose, isOpen, location.pathname]);

  return (
    <div className={`cart-drawer ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
      <button
        type="button"
        className="cart-backdrop"
        onClick={handleClose}
        aria-label="Close cart"
      />
      <aside
        className={`cart-overlay ${isOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        <div className="cart-header">
          <div className="cart-header-copy">
            <p className="cart-kicker">Bag</p>
            <h2 id="cart-title">Your Cart</h2>
            <p className="cart-header-summary">
              {itemCount > 0
                ? `${itemCount} ${itemCount === 1 ? "item" : "items"} ready`
                : "No items added yet"}
            </p>
          </div>
          <div className="cart-header-actions">
            <button type="button" className="close-cart" onClick={handleClose} aria-label="Close cart">
              <AppIcon icon={faTimes} />
            </button>
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-illus" aria-hidden="true">
              <AppIcon icon={faShoppingCart} />
            </div>
            <strong>Your cart is empty.</strong>
            <p>Add balloons, supplies, or rentals to start building your order.</p>
            <div className="cart-empty-actions">
              <Link to="/shop" className="checkout-btn" onClick={handleClose}>
                Browse the shop
              </Link>
              <Link to="/rentals" className="ghost-btn" onClick={handleClose}>
                Explore rentals
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cartSections.map((section) => {
                const sectionConfig = CART_SECTION_CONFIG[section.key];
                const sectionCount = section.items.reduce(
                  (acc, item) => acc + getCartItemBillingQuantity(item),
                  0
                );
                return (
                  <section className="cart-section" key={section.key} aria-labelledby={`cart-section-${section.key}`}>
                    <div className="cart-section-head">
                      <h3 id={`cart-section-${section.key}`}>{sectionConfig.title}</h3>
                      <p className="cart-section-meta">
                        {sectionCount} {sectionCount === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <p className="cart-section-note">{sectionConfig.note}</p>
                    <div className="cart-section-list">
                      {section.items.map((item) => {
                        const available = isCartItemStockTracked(item)
                          ? getCartItemQuantity(item) - item.cartQuantity
                          : null;
                        const maxSelectable = getCartItemMaxSelectableQuantity(item);
                        const itemKey = getCartItemKey(item);
                        const itemCategory = getCartItemCategory(item);
                        const itemDisplayName = getCatalogItemDisplayName(item, "item");
                        const itemRateLabel = getCartItemRateLabel(item);
                        return (
                          <div key={itemKey} className="cart-item">
                            <div
                              className="cart-item-media category-image-bg"
                              style={getCatalogItemBackgroundStyle(item)}
                            >
                              <img
                                className="cart-image"
                                src={getCatalogItemImage(item)}
                                alt={itemDisplayName}
                              />
                            </div>
                            <div className="cart-item-body">
                              <div className="cart-item-top">
                                <div>
                                  <p className="cart-item-name">{itemDisplayName}</p>
                                  {itemCategory ? (
                                    <span className="cart-item-type">{itemCategory}</span>
                                  ) : null}
                                </div>
                                <button
                                  className="cart-remove"
                                  type="button"
                                  onClick={() => removeFromCart(item)}
                                  aria-label={`Remove ${itemDisplayName}`}
                                >
                                  <AppIcon icon={faTrash} />
                                </button>
                              </div>

                              <div className="cart-item-meta">
                                <div className="cart-qty-controls">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      item.cartQuantity <= 1
                                        ? removeFromCart(item)
                                        : updateQuantity(item, -1)
                                    }
                                    aria-label={`Decrease ${itemDisplayName} quantity`}
                                  >
                                    <AppIcon icon={faMinus} />
                                  </button>
                                  <span>{item.cartQuantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item, 1)}
                                    disabled={item.cartQuantity >= maxSelectable}
                                    aria-label={`Increase ${itemDisplayName} quantity`}
                                  >
                                    <AppIcon icon={faPlus} />
                                  </button>
                                  <p className="cart-stock">
                                    {available === null
                                      ? "Guest count entered"
                                      : available > 0
                                        ? `${available} available`
                                        : "Max reserved"}
                                  </p>
                                </div>
                                <div className="cart-price">
                                  <span className="cart-price-each">
                                    {formatCurrency(convertPrice(getCartItemPrice(item)))} {itemRateLabel}
                                  </span>
                                  <span className="cart-price-total">
                                    {formatCurrency(convertPrice(getCartItemLineTotal(item)))}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="cart-footer">
              <div className="subtotal">
                <div className="cart-footer-copy">
                  <strong>Subtotal</strong>
                  <span>
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="cart-footer-total">
                  <strong>{subtotalLabel}</strong>
                </div>
              </div>
              {rentalCount > 0 || shopCount > 0 ? (
                <div className="cart-footer-breakdown" aria-label="Cart breakdown">
                  {rentalCount > 0 ? (
                    <div className="cart-footer-row">
                      <span>Rentals</span>
                      <strong>{rentalCount}</strong>
                    </div>
                  ) : null}
                  {shopCount > 0 ? (
                    <div className="cart-footer-row">
                      <span>Shop items</span>
                      <strong>{shopCount}</strong>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className="cart-note">Taxes, pickup, and delivery timing are confirmed at checkout.</p>
              <Link to="/cart" className="checkout-btn cart-primary-action" onClick={handleClose}>
                Go to cart
              </Link>
              <div className="foot-items">
                <button type="button" className="clear-cart" onClick={clearCart}>
                  Clear Cart
                </button>
                <button type="button" className="ghost-btn" onClick={handleClose}>
                  Continue shopping
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export default CartOverlay;
