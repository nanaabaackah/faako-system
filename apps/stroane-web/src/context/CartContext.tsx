import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

interface CartContextValue {
  cart: Record<string, number>;
  totalCount: number;
  getQty: (id: string) => number;
  increment: (id: string) => void;
  decrement: (id: string) => void;
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
  const [cart, setCart] = useState<Record<string, number>>({});

  const increment = useCallback((id: string) => {
    setCart((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  }, []);

  const decrement = useCallback((id: string) => {
    setCart((current) => {
      const next = (current[id] ?? 0) - 1;
      if (next < 1) return current;
      return { ...current, [id]: next };
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
    () => ({ cart, totalCount, getQty, increment, decrement, remove, clear }),
    [cart, totalCount, getQty, increment, decrement, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
