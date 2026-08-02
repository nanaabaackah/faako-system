import React, { useMemo } from "react";
import "./Cart.css";
import { AppIcon } from "/src/components/Icon/Icon";
import { faArrowLeft, faGift, faLock, faTrash, faTruck } from "/src/icons/iconSet";
import { Link } from "react-router-dom";
import { useCart } from "../../components/CartContext/CartContext";
import {
  getCatalogItemBackgroundStyle,
  getCatalogItemDisplayName,
  getCatalogItemImage,
} from "/src/utils/itemMediaBackgrounds";
import {
  getCartItemBillingQuantity,
  getCartItemCategory,
  getCartItemLineTotal,
  getCartItemMaxSelectableQuantity,
  getCartItemPrice,
  getCartItemQuantity,
  getCartItemQuantityLabel,
  getCartItemRateLabel,
  isCartItemStockTracked,
  isRentalCartItem,
  splitCartItems,
} from "/src/utils/cart";

const CART_SECTION_CONFIG = {
  rentals: {
    title: "Rental items",
    kicker: "Booking list",
    note: "Rental quantities stay grouped here so you can review booking items separately from shop pickup items.",
  },
  shop: {
    title: "Shop items",
    kicker: "Pickup supplies",
    note: "Decor, balloons, and supplies stay in their own section for pickup and packing.",
  },
};

const Cart = () => {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    convertPrice,
    formatCurrency,
    clearCart,
  } = useCart();

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
  const subtotal = cart.reduce((acc, item) => acc + getCartItemLineTotal(item), 0);
  const convertedSubtotal = convertPrice(subtotal);
  const formattedSubtotal = formatCurrency(convertedSubtotal);
  const rentalCount = cartGroups.rentals.reduce((acc, item) => acc + getCartItemBillingQuantity(item), 0);
  const shopCount = cartGroups.shop.reduce((acc, item) => acc + getCartItemBillingQuantity(item), 0);
  const hasRentalItems = cart.some((item) => isRentalCartItem(item));
  const hasShopItems = shopCount > 0;
  const fulfillmentNote =
    hasRentalItems && hasShopItems
      ? "Mixed carts are reviewed with you at checkout."
      : hasRentalItems
        ? "Pickup or delivery confirmed at checkout"
        : "In-store pickup only";

  const handleQtyChange = (item, value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    const maxQty = Math.max(1, getCartItemMaxSelectableQuantity(item) || 1);
    const clamped = Math.min(Math.max(parsed, 1), maxQty);
    updateQuantity(item.id, clamped - item.cartQuantity);
  };

  const stockLeft = (item) =>
    isCartItemStockTracked(item)
      ? Math.max(getCartItemQuantity(item) - item.cartQuantity, 0)
      : null;

  return (
    <main className="cart-shell page-shell" id="main">
      <section className="cart-hero page-hero" id="cart-intro" aria-labelledby="cart-heading">
        <div className="cart-hero-copy back-heading page-hero-copy">
          <h1 id="cart-heading" className="page-hero-title">Your Cart</h1>
          <p className="cart-hero-sub">
            Review rentals and shop items side by side, adjust quantities, and head to checkout when the mix feels right.
          </p>
          <div className="cart-hero-pills" aria-label="Cart highlights">
            <span className="pill">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
            <span className="pill pill-accent">Subtotal {formattedSubtotal}</span>
          </div>
        </div>
        <div className="cart-hero-card">
          <div className="cart-hero-card-head">
            <p className="cart-hero-note">{fulfillmentNote}</p>
          </div>
          <div className="hero-card-perks">
            <span><AppIcon icon={faTruck} /> Timing confirmed after review</span>
            <span><AppIcon icon={faLock} /> Secure checkout</span>
            <span><AppIcon icon={faGift} /> Packed for party day</span>
          </div>
        </div>
      </section>

      <section className="cart-body" id="cart-info">
        {cart.length === 0 ? (
          <div className="cart-empty-card">
            <div className="cart-empty-illus" aria-hidden="true">⋆</div>
            <h2>Cart feels a little lonely</h2>
            <p>Add rentals or supplies to see them shine here.</p>
            <div className="cart-empty-actions">
              <Link className="hero-btn hero-btn-primary" to="/shop">Browse shop</Link>
              <Link className="hero-btn hero-btn-ghost" to="/rentals">View rentals</Link>
            </div>
          </div>
        ) : (
          <div className="cart-grid cart-page">
            <div className="cart-main">
              <div className="cart-toolbar">
                <div>
                  <p className="kicker">Cart sections</p>
                  <h3>Review each section before checkout</h3>
                </div>
                <div className="toolbar-actions">
                  <button className="ghost-btn clear-all" onClick={clearCart}>Clear cart</button>
                  <Link className="pill-link" to="/rentals">
                    <AppIcon icon={faArrowLeft} /> View rentals
                  </Link>
                  <Link className="pill-link" to="/shop">
                    Browse shop
                  </Link>
                </div>
              </div>

              <div className="cart-list">
                {cartSections.map((section) => {
                  const sectionConfig = CART_SECTION_CONFIG[section.key];
                  const sectionCount = section.items.reduce(
                    (acc, item) => acc + getCartItemBillingQuantity(item),
                    0
                  );
                  const sectionSubtotal = section.items.reduce((acc, item) => acc + getCartItemLineTotal(item), 0);

                  return (
                    <section
                      className={`cart-group cart-group--${section.key}`}
                      key={section.key}
                      aria-labelledby={`cart-group-${section.key}`}
                    >
                      <div className="cart-group-head">
                        <div>
                          <p className="cart-group-kicker">{sectionConfig.kicker}</p>
                          <h3 id={`cart-group-${section.key}`}>{sectionConfig.title}</h3>
                        </div>
                        <div className="cart-group-summary">
                          <strong>{formatCurrency(convertPrice(sectionSubtotal))}</strong>
                          <span>{sectionCount} {sectionCount === 1 ? "item" : "items"}</span>
                        </div>
                      </div>
                      <p className="cart-group-note">{sectionConfig.note}</p>

                      <div className="cart-group-list">
                        {section.items.map((item, index) => {
                          const itemDisplayName = getCatalogItemDisplayName(item, "Item");
                          const itemRateLabel = getCartItemRateLabel(item);
                          const itemQuantityLabel = getCartItemQuantityLabel(item);
                          const itemMaxQty = getCartItemMaxSelectableQuantity(item);
                          const itemStockLeft = stockLeft(item);
                          return (
                            <article
                              className="cart-line"
                              key={item.id}
                              style={{ "--cart-delay": `${Math.min(index, 8) * 0.05}s` }}
                            >
                              <div
                                className="cart-line-media category-image-bg"
                                style={getCatalogItemBackgroundStyle(item)}
                              >
                                <img src={getCatalogItemImage(item)} alt={itemDisplayName} loading="lazy" />
                                {getCartItemCategory(item) ? (
                                  <span className="cart-chip">{getCartItemCategory(item)}</span>
                                ) : null}
                              </div>
                              <div className="cart-line-content">
                                <div className="cart-line-top">
                                  <div>
                                    <h3>{itemDisplayName}</h3>
                                  </div>
                                  <button
                                    className="cart-line-remove"
                                    onClick={() => removeFromCart(item.id)}
                                    aria-label={`Remove ${itemDisplayName}`}
                                  >
                                    <AppIcon icon={faTrash} />
                                  </button>
                                </div>

                                <div className="cart-line-grid">
                                  <div className="cart-line-price">
                                    <strong>{formatCurrency(convertPrice(getCartItemPrice(item)))}</strong>
                                    <span className="muted">{itemRateLabel}</span>
                                  </div>

                                  <div className="cart-line-qty">
                                    <p className="label">{itemQuantityLabel}</p>
                                    <div className="qty-input">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          item.cartQuantity <= 1
                                            ? removeFromCart(item.id)
                                            : updateQuantity(item.id, -1)
                                        }
                                        aria-label={`Decrease ${itemDisplayName} quantity`}
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min={1}
                                        max={isCartItemStockTracked(item) ? itemMaxQty : undefined}
                                        value={item.cartQuantity}
                                        onChange={(e) => handleQtyChange(item, e.target.value)}
                                        aria-label={`${itemDisplayName} quantity`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => updateQuantity(item.id, 1)}
                                        disabled={item.cartQuantity >= itemMaxQty}
                                        aria-label={`Increase ${itemDisplayName} quantity`}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  <div className="cart-line-total">
                                    <strong>{formatCurrency(convertPrice(getCartItemLineTotal(item)))}</strong>
                                    <span className="muted">
                                      {itemStockLeft === null
                                        ? "Charged by guest count"
                                        : itemStockLeft > 0
                                          ? `${itemStockLeft} spare`
                                          : "Max stock reached"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>

            <aside className="cart-summary-card" aria-label="Order summary">
              <div className="summary-head">
                <p className="kicker">Summary</p>
                <h3>Ready to book?</h3>
                <p className="muted">Taxes, pickup, and delivery timing are confirmed at checkout.</p>
              </div>
              <div className="summary-rows">
                <div className="summary-row">
                  <span>Items</span>
                  <span>{itemCount}</span>
                </div>
                {rentalCount > 0 ? (
                  <div className="summary-row">
                    <span>Rentals</span>
                    <span>{rentalCount}</span>
                  </div>
                ) : null}
                {shopCount > 0 ? (
                  <div className="summary-row">
                    <span>Shop items</span>
                    <span>{shopCount}</span>
                  </div>
                ) : null}
                <div className="summary-row summary-row-total">
                  <span>Subtotal</span>
                  <strong>{formattedSubtotal}</strong>
                </div>
              </div>
              <Link className="checkout-btn" to="/checkout">Proceed to Checkout</Link>
              <div className="cart-summary-actions">
                <Link className="ghost-btn summary-continue" to="/shop">
                  Add shop items
                </Link>
                <Link className="ghost-btn summary-continue" to="/rentals">
                  Add rentals
                </Link>
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
};

export default Cart;
