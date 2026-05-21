import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const CART_STORAGE_KEY = "stroane_cart_v1";
const MAX_CART_QUANTITY = 99;

const normalizeCart = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value).reduce<Record<string, number>>((next, [id, qty]) => {
    const quantity = Number(qty);
    if (!id || !Number.isInteger(quantity) || quantity < 1) return next;
    next[id] = Math.min(quantity, MAX_CART_QUANTITY);
    return next;
  }, {});
};

const readStoredCart = () => {
  if (typeof window === "undefined") return {};

  try {
    return normalizeCart(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || "{}"));
  } catch {
    return {};
  }
};

interface CartContextValue {
  cart: Record<string, number>;
  totalCount: number;
  getQty: (id: string) => number;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export const useCart = (): CartContextValue => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Record<string, number>>(readStoredCart);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const increment = useCallback((id: string) => {
    setCart((current) => ({
      ...current,
      [id]: Math.min((current[id] ?? 0) + 1, MAX_CART_QUANTITY),
    }));
  }, []);

  const decrement = useCallback((id: string) => {
    setCart((current) => {
      const next = (current[id] ?? 0) - 1;
      if (next < 1) return current;
      return { ...current, [id]: next };
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setCart((current) => {
      if (!Number.isInteger(quantity) || quantity < 1) {
        const next = { ...current };
        delete next[id];
        return next;
      }

      return { ...current, [id]: Math.min(quantity, MAX_CART_QUANTITY) };
    });
  }, []);

  const remove = useCallback((id: string) => {
    setCart((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const clear = useCallback(() => setCart({}), []);

  const getQty = useCallback((id: string) => cart[id] ?? 0, [cart]);

  const totalCount = useMemo(
    () => Object.values(cart).reduce((sum, n) => sum + n, 0),
    [cart]
  );

  const value = useMemo<CartContextValue>(
    () => ({ cart, totalCount, getQty, increment, decrement, updateQuantity, remove, clear }),
    [cart, totalCount, getQty, increment, decrement, updateQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
