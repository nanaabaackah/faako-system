import { Link } from "react-router-dom";
import {
  getHomeShopBackground,
  getHomeShopCategory,
  getHomeShopImage,
  getHomeShopPrice,
  hasHomeShopImage,
} from "/src/components/home/homeCatalog";
import {
  createCatalogCssImageStyle,
  getCatalogItemDisplayName,
} from "/src/utils/itemMediaBackgrounds";

function HomeShopHighlightsSection({
  popularShopItems,
  activeShopPanelIndex,
  setActiveShopPanelIndex,
  convertPrice,
  formatCurrency,
}) {
  if (!popularShopItems.length) return null;

  return (
    <section className="home-flow home-flow--shop">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Easy Add-Ons People Grab With Their Rentals</h2>
          <p className="section-description">
            Quick party extras and practical supplies customers keep adding to their setup.
          </p>
        </div>

        <div className="home-shop-panels" role="list" aria-label="Popular shop items">
          {popularShopItems.map((item, index) => {
            const itemKey = item.id || item.productId || item.slug || `${item.name}-${index}`;
            const itemPrice = getHomeShopPrice(item);
            const itemCategory = getHomeShopCategory(item);
            const itemDisplayName = getCatalogItemDisplayName(item, itemCategory || "Shop item");
            const hasImage = hasHomeShopImage(item);
            const isActive = index === activeShopPanelIndex;

            return (
              <Link
                key={itemKey}
                to={`/shop?q=${encodeURIComponent(item.name || itemCategory)}`}
                className={`home-shop-panel ${isActive ? "is-active" : ""} ${hasImage ? "" : "is-missing-image"}`}
                role="listitem"
                style={createCatalogCssImageStyle(
                  getHomeShopBackground(item),
                  "--home-shop-panel-bg"
                )}
                onMouseEnter={() => setActiveShopPanelIndex(index)}
                onFocus={() => setActiveShopPanelIndex(index)}
                onTouchStart={() => setActiveShopPanelIndex(index)}
                onClick={() => setActiveShopPanelIndex(index)}
                aria-label={`${itemDisplayName}. ${itemCategory}. View in shop.`}
              >
                {hasImage ? (
                  <img
                    src={getHomeShopImage(item)}
                    alt={itemDisplayName}
                    className="home-shop-panel-media"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div
                    className="home-shop-image-fallback"
                    role="img"
                    aria-label={`${itemDisplayName} image not available`}
                  >
                    <span>Image not available</span>
                  </div>
                )}
                <span className="home-shop-panel-overlay" aria-hidden="true" />
                <div className="home-shop-panel-copy">
                  <p>{itemCategory}</p>
                  <h3>{itemDisplayName}</h3>
                  <span className="home-shop-panel-price">
                    {itemPrice ? formatCurrency(convertPrice(itemPrice)) : "Browse in shop"}
                  </span>
                  <span className="home-shop-panel-cta">View item →</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="featured-more">
          <Link to="/shop" className="btn btn-primary btn-lg">Browse All Shop Items</Link>
        </div>
      </div>
    </section>
  );
}

export default HomeShopHighlightsSection;
