import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const STORAGE_TOKEN_KEY = "managerAuthToken";
const DEFAULT_REFRESH_MS = 30000;

const getApiBase = () =>
  process.env.EXPO_PUBLIC_API_BASE_URL
  || Constants.expoConfig?.extra?.apiBaseUrl
  || "http://localhost:8888";

const formatMoney = (value, currency = "GHS") => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${currency} 0.00`;
  return `${currency} ${numeric.toFixed(2)}`;
};

const formatDate = (value) => {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBD";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (dateValue, startTime, endTime) => {
  const dateLabel = formatDate(dateValue);
  const timeLabel = startTime ? `${startTime}${endTime ? `-${endTime}` : ""}` : "";
  return timeLabel ? `${dateLabel} ${timeLabel}` : dateLabel;
};

const formatWindow = (value) => {
  const map = {
    "9am-11am": "9:00am-11:00am",
    "11am-1pm": "11:00am-1:00pm",
    "1pm-3pm": "1:00pm-3:00pm",
    "3pm-5pm": "3:00pm-5:00pm",
    "5pm-7pm": "5:00pm-7:00pm",
  };
  if (!value) return "Window TBD";
  return map[value] || value;
};

const getOrderFulfillment = (order) => {
  const pickup = String(order?.deliveryMethod || "").toLowerCase().includes("pickup");
  const details = pickup ? order?.pickupDetails : order?.deliveryDetails;
  return {
    pickup,
    methodLabel: pickup ? "Pickup" : "Delivery",
    date: details?.date,
    window: details?.window,
    address: details?.address,
    contact: details?.contact,
    notes: details?.notes,
  };
};

const getProjectId = () =>
  Constants.expoConfig?.extra?.expoProjectId || Constants.easConfig?.projectId || null;

const registerForPushNotificationsAsync = async () => {
  try {
    if (!Device.isDevice) return null;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;
    const projectId = getProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data;
  } catch (err) {
    console.warn("Push registration failed", err?.message || err);
    return null;
  }
};

const fetchWithAuth = async (path, token, options = {}) => {
  const base = getApiBase();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || "Request failed.";
    throw new Error(message);
  }
  return data;
};

const SectionHeader = ({ title, subtitle }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
  </View>
);

const ItemList = ({ items }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <Text style={styles.muted}>No items listed.</Text>;
  }
  return (
    <View style={styles.itemList}>
      {items.map((item, index) => (
        <View key={`${item.id || item.productId}-${index}`} style={styles.itemRow}>
          <Text style={styles.itemName}>
            {item.productName || item.name || `Item ${item.productId || ""}`}
          </Text>
          <Text style={styles.itemMeta}>
            Qty {item.quantity || 0}
          </Text>
        </View>
      ))}
    </View>
  );
};

const OrderCard = ({ order }) => {
  const details = getOrderFulfillment(order);
  const items = Array.isArray(order.items) ? order.items : [];
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>{order.orderNumber || `Order #${order.id}`}</Text>
        <Text style={styles.badge}>{order.status || "pending"}</Text>
      </View>
      <Text style={styles.cardSubtitle}>{order.customerName || "Customer"}</Text>
      <Text style={styles.cardMeta}>
        {details.methodLabel} · {details.date ? formatDate(details.date) : "Date TBD"} · {formatWindow(details.window)}
      </Text>
      {details.address ? <Text style={styles.cardMeta}>Address: {details.address}</Text> : null}
      {details.contact ? <Text style={styles.cardMeta}>Contact: {details.contact}</Text> : null}
      <Text style={styles.cardAmount}>{formatMoney(order.total)}</Text>
      <ItemList items={items} />
      {details.notes ? <Text style={styles.note}>Notes: {details.notes}</Text> : null}
    </View>
  );
};

const BookingCard = ({ booking }) => {
  const items = Array.isArray(booking.items) ? booking.items : [];
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>{`Booking #${booking.id}`}</Text>
        <Text style={styles.badge}>{booking.status || "pending"}</Text>
      </View>
      <Text style={styles.cardSubtitle}>{booking.customerName || "Customer"}</Text>
      <Text style={styles.cardMeta}>
        {formatDateTime(booking.eventDate, booking.startTime, booking.endTime)}
      </Text>
      {booking.venueAddress ? (
        <Text style={styles.cardMeta}>Venue: {booking.venueAddress}</Text>
      ) : null}
      <Text style={styles.cardAmount}>{formatMoney(booking.total)}</Text>
      <ItemList items={items} />
    </View>
  );
};

const LoginScreen = ({ pin, setPin, onSubmit, error, loading }) => (
  <View style={styles.loginContainer}>
    <Text style={styles.loginTitle}>Manager Login</Text>
    <Text style={styles.muted}>Enter your 6-digit PIN to continue.</Text>
    <TextInput
      style={styles.pinInput}
      value={pin}
      onChangeText={setPin}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={6}
      placeholder="------"
      placeholderTextColor="#a5afc2"
    />
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
    <TouchableOpacity
      style={[styles.primaryButton, loading && styles.buttonDisabled]}
      onPress={onSubmit}
      disabled={loading}
    >
      <Text style={styles.primaryButtonText}>{loading ? "Signing in..." : "Sign in"}</Text>
    </TouchableOpacity>
  </View>
);

const App = () => {
  const [authToken, setAuthToken] = useState(null);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);
      if (stored) setAuthToken(stored);
    };
    load();
  }, []);

  const handleLogin = useCallback(async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await fetchWithAuth(
        "/.netlify/functions/managerLogin",
        null,
        {
          method: "POST",
          body: JSON.stringify({ pin }),
        }
      );
      if (!response?.token) throw new Error("Login failed.");
      await AsyncStorage.setItem(STORAGE_TOKEN_KEY, response.token);
      setAuthToken(response.token);
      setPin("");
    } catch (err) {
      setAuthError(err.message || "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  }, [pin]);

  const handleLogout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
    setAuthToken(null);
  }, []);

  const registerDevice = useCallback(async () => {
    if (!authToken) return;
    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (!pushToken) return;
      await fetchWithAuth("/.netlify/functions/managerTokens", authToken, {
        method: "POST",
        body: JSON.stringify({
          token: pushToken,
          platform: Platform.OS,
          deviceId: Device.deviceName || null,
        }),
      });
    } catch (err) {
      console.warn("Token registration failed", err?.message || err);
    }
  }, [authToken]);

  const loadData = useCallback(async () => {
    if (!authToken) return;
    setDataLoading(true);
    try {
      const [ordersData, bookingsData] = await Promise.all([
        fetchWithAuth("/.netlify/functions/managerOrders", authToken),
        fetchWithAuth("/.netlify/functions/managerBookings", authToken),
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn("Failed to load data", err?.message || err);
    } finally {
      setDataLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    registerDevice();
    loadData();
    const id = setInterval(loadData, DEFAULT_REFRESH_MS);
    const subscription = Notifications.addNotificationReceivedListener(() => {
      loadData();
    });
    return () => {
      clearInterval(id);
      subscription.remove();
    };
  }, [authToken, loadData, registerDevice]);

  const data = useMemo(() => (tab === "orders" ? orders : bookings), [orders, bookings, tab]);

  if (!authToken) {
    return (
      <SafeAreaView style={styles.container}>
        <LoginScreen
          pin={pin}
          setPin={setPin}
          onSubmit={handleLogin}
          error={authError}
          loading={authLoading}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manager Feed</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.headerAction}>Log out</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === "orders" && styles.tabActive]}
          onPress={() => setTab("orders")}
        >
          <Text style={styles.tabText}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === "bookings" && styles.tabActive]}
          onPress={() => setTab("bookings")}
        >
          <Text style={styles.tabText}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <SectionHeader
        title={tab === "orders" ? "Latest Orders" : "Latest Bookings"}
        subtitle={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Fetching data..."}
      />
      {dataLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#ff7a59" />
          <Text style={styles.muted}>Refreshing...</Text>
        </View>
      ) : null}
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) =>
          tab === "orders" ? <OrderCard order={item} /> : <BookingCard booking={item} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.muted}>No records yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f7fb",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2633",
  },
  headerAction: {
    color: "#ff7a59",
    fontWeight: "700",
  },
  tabRow: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d9deea",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  tabActive: {
    borderColor: "#ff7a59",
    backgroundColor: "#fff0ea",
  },
  tabText: {
    fontWeight: "700",
    color: "#1f2633",
  },
  refreshButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#1bb89b",
  },
  refreshText: {
    color: "#fff",
    fontWeight: "700",
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2633",
  },
  sectionSubtitle: {
    color: "#6a748d",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e4e8f2",
    gap: 6,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2633",
  },
  cardSubtitle: {
    fontWeight: "600",
    color: "#3c4556",
  },
  cardMeta: {
    color: "#586175",
    fontSize: 13,
  },
  cardAmount: {
    fontWeight: "700",
    color: "#1bb89b",
  },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ff7a59",
    backgroundColor: "#fff0ea",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  itemList: {
    marginTop: 4,
    gap: 4,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemName: {
    fontWeight: "600",
    color: "#1f2633",
  },
  itemMeta: {
    color: "#6a748d",
  },
  note: {
    marginTop: 6,
    color: "#6a748d",
    fontStyle: "italic",
  },
  muted: {
    color: "#6a748d",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  loginContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 12,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2633",
  },
  pinInput: {
    borderWidth: 1,
    borderColor: "#d9deea",
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: "center",
    backgroundColor: "#fff",
    color: "#1f2633",
  },
  primaryButton: {
    backgroundColor: "#ff7a59",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: "#c0392b",
    fontWeight: "600",
  },
});
