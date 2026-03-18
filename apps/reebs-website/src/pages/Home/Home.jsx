import React, { useEffect, useRef, useState } from "react";
import "./Home.css";
import { useNavigate } from "react-router-dom";
import PopupModal from "../../components/PopupModal/PopupModal";
import CookieBanner from "../../components/CookieBanner/CookieBanner";
import { useCart } from "../../components/CartContext/CartContext";
import {
  fetchInventoryWithCache,
  splitInventory,
} from "../../utils/inventoryCache";
import {
  isOnlineShopItem,
  isTestCategoryItem,
} from "../../utils/frontendInventoryFilters";
import {
  DEFAULT_TEMPLATE_CONFIG,
  useTemplateConfig,
} from "../../context/TemplateConfigContext";
import {
  clearExpiringDraft,
  loadExpiringDraft,
  saveExpiringDraft,
} from "../../utils/formDrafts";
import HomeFeaturedRentalsSection from "../../components/home/HomeFeaturedRentalsSection";
import HomeHeroSection from "../../components/home/HomeHeroSection";
import HomeMomentsSection from "../../components/home/HomeMomentsSection";
import HomeProcessSection from "../../components/home/HomeProcessSection";
import HomeQuickAnswersSection from "../../components/home/HomeQuickAnswersSection";
import HomeServicesSection from "../../components/home/HomeServicesSection";
import HomeShopHighlightsSection from "../../components/home/HomeShopHighlightsSection";
import HomeWhySection from "../../components/home/HomeWhySection";
import {
  getHomeRentalPopularityScore,
  getHomeShopPopularityScore,
  hasHomeShopImage,
  isHomeShopSoldOut,
} from "../../components/home/homeCatalog";
import { SERVICE_START_YEAR } from "../../components/home/homeContent";

const HOME_HERO_DRAFT_KEY = "homeHeroLeadDraft";

function Home() {
  const navigate = useNavigate();
  const heroVideoRef = useRef(null);
  const [suggestedRentals, setSuggestedRentals] = useState([]);
  const [popularShopItems, setPopularShopItems] = useState([]);
  const [activeFeaturedRentalIndex, setActiveFeaturedRentalIndex] = useState(0);
  const [activeShopPanelIndex, setActiveShopPanelIndex] = useState(0);
  const [heroStats, setHeroStats] = useState({
    inventory: null,
    rentals: null,
  });
  const [heroEmail, setHeroEmail] = useState("");
  const { convertPrice, formatCurrency } = useCart();
  const { config } = useTemplateConfig();
  const templateSettings = { ...DEFAULT_TEMPLATE_CONFIG, ...config };
  const yearsServing = Math.max(0, new Date().getFullYear() - SERVICE_START_YEAR);
  const yearsServingBadge = Math.floor(yearsServing / 5) * 5;

  useEffect(() => {
    const savedDraft = loadExpiringDraft(HOME_HERO_DRAFT_KEY);
    if (typeof savedDraft === "string") {
      setHeroEmail(savedDraft);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadData = async () => {
      try {
        const { items } = await fetchInventoryWithCache({ signal: controller.signal });
        if (!isMounted) return;

        const safeItems = Array.isArray(items) ? items : [];
        const { rentals, products } = splitInventory(safeItems);
        const activeRentals = rentals.filter((item) => (item.status ?? item.isActive) !== false);
        const topRentals = [...activeRentals]
          .sort((a, b) => {
            const scoreDiff =
              getHomeRentalPopularityScore(b) - getHomeRentalPopularityScore(a);
            if (scoreDiff !== 0) return scoreDiff;
            return `${a.name || ""}`.localeCompare(`${b.name || ""}`);
          })
          .slice(0, 4);
        const visibleProducts = products.filter(
          (item) =>
            isOnlineShopItem(item) &&
            !isTestCategoryItem(item) &&
            hasHomeShopImage(item)
        );
        const availableProducts = visibleProducts.filter(
          (item) => !isHomeShopSoldOut(item)
        );
        const topShopItems = [...(availableProducts.length ? availableProducts : visibleProducts)]
          .sort((a, b) => {
            const scoreDiff =
              getHomeShopPopularityScore(b) - getHomeShopPopularityScore(a);
            if (scoreDiff !== 0) return scoreDiff;
            return `${a.name || ""}`.localeCompare(`${b.name || ""}`);
          })
          .slice(0, 4);

        setSuggestedRentals(topRentals);
        setPopularShopItems(topShopItems);
        setHeroStats({
          inventory: safeItems.length,
          rentals: activeRentals.length,
        });
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("Error loading data:", err);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!suggestedRentals.length) {
      setActiveFeaturedRentalIndex(0);
      return;
    }

    setActiveFeaturedRentalIndex((prev) =>
      Math.min(prev, suggestedRentals.length - 1)
    );
  }, [suggestedRentals.length]);

  useEffect(() => {
    if (!popularShopItems.length) {
      setActiveShopPanelIndex(0);
      return;
    }

    setActiveShopPanelIndex((prev) => Math.min(prev, popularShopItems.length - 1));
  }, [popularShopItems.length]);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return undefined;

    const safePlay = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    };

    const restartLoop = () => {
      video.currentTime = 0;
      safePlay();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) safePlay();
    };

    const rafId = window.requestAnimationFrame(safePlay);
    safePlay();

    video.addEventListener("canplay", safePlay);
    video.addEventListener("loadedmetadata", safePlay);
    video.addEventListener("ended", restartLoop);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(rafId);
      video.removeEventListener("canplay", safePlay);
      video.removeEventListener("loadedmetadata", safePlay);
      video.removeEventListener("ended", restartLoop);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const normalizedEmail = heroEmail.trim();
    if (!normalizedEmail) {
      clearExpiringDraft(HOME_HERO_DRAFT_KEY);
      return;
    }
    saveExpiringDraft(HOME_HERO_DRAFT_KEY, normalizedEmail);
  }, [heroEmail]);

  const handleHeroLeadSubmit = (event) => {
    event.preventDefault();
    const leadEmail = heroEmail.trim();
    clearExpiringDraft(HOME_HERO_DRAFT_KEY);
    navigate("/contact", { state: leadEmail ? { leadEmail } : undefined });
  };

  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      <CookieBanner />
      <PopupModal />

      <main className="home" id="main" role="main">
        <HomeHeroSection
          heroVideoRef={heroVideoRef}
          templateSettings={templateSettings}
          heroEmail={heroEmail}
          onHeroEmailChange={setHeroEmail}
          onHeroLeadSubmit={handleHeroLeadSubmit}
          heroStats={heroStats}
          yearsServingBadge={yearsServingBadge}
        />
        <HomeWhySection />
        <HomeProcessSection />
        <HomeServicesSection />
        <HomeFeaturedRentalsSection
          suggestedRentals={suggestedRentals}
          activeFeaturedRentalIndex={activeFeaturedRentalIndex}
          setActiveFeaturedRentalIndex={setActiveFeaturedRentalIndex}
        />
        <HomeShopHighlightsSection
          popularShopItems={popularShopItems}
          activeShopPanelIndex={activeShopPanelIndex}
          setActiveShopPanelIndex={setActiveShopPanelIndex}
          convertPrice={convertPrice}
          formatCurrency={formatCurrency}
        />
        <HomeMomentsSection />
        <HomeQuickAnswersSection />
      </main>
    </>
  );
}

export default Home;
