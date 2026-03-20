import React, { useState, useEffect, useCallback, useMemo } from "react";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "500px"
};

const reebsLocation = {
  lat: 5.629976957360835,  
  lng: -0.06104706927628969
};

const USER_MARKER_ICON_URL = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";

// White & Black Map Style
const whiteBlackMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }] // White background
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#000000" }] // Black text
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#ffffff" }] // White outline
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#434343" }] // Black roads
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#333333" }] // Dark gray borders
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#f4f4f4" }] // Light gray water
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }] // Very light gray POIs
  }
];

function MapComponent() {
  const [userLocation, setUserLocation] = useState(null);
  const [selected, setSelected] = useState(null);
  const [scriptError, setScriptError] = useState(null);
  const [geoStatus, setGeoStatus] = useState("idle");
  const [mapInstance, setMapInstance] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;

  const mapOptions = useMemo(
    () => ({
      styles: whiteBlackMapStyle,
      disableDefaultUI: false,
      zoomControl: true,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      clickableIcons: false
    }),
    []
  );

  const focusLocation = useCallback(
    (position, zoom = 14) => {
      if (!position || !mapInstance) return;
      mapInstance.panTo(position);
      mapInstance.setZoom(zoom);
    },
    [mapInstance]
  );

  const getUserLocation = useCallback(
    (focusOnSuccess = false) => {
      if (!navigator.geolocation) {
        setGeoStatus("unsupported");
        return;
      }

      setGeoStatus("requesting");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nextLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          setUserLocation(nextLocation);
          setGeoStatus("granted");
          if (focusOnSuccess) {
            focusLocation(nextLocation);
          }
        },
        (err) => {
          setGeoStatus("denied");
          console.warn("Geolocation error:", err.message);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    },
    [focusLocation]
  );

  useEffect(() => {
    const computeOpenStatus = () => {
      const now = new Date();
      const day = now.getUTCDay(); // 0 = Sunday
      const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      const openMinutes = 8 * 60 + 30; // 8:30
      const closeMinutes = 19 * 60; // 19:00
      const isOpenNow = day >= 1 && day <= 6 && minutes >= openMinutes && minutes < closeMinutes;
      setIsOpen(isOpenNow);
    };
    computeOpenStatus();
    const id = setInterval(computeOpenStatus, 60000);
    return () => clearInterval(id);
  }, []);

  const focusShop = () => {
    if (mapInstance) {
      focusLocation(reebsLocation);
      setSelected({ name: "REEBS Party Themes", position: reebsLocation });
    }
  };

  const focusUser = () => {
    if (userLocation) {
      focusLocation(userLocation);
      return;
    }
    getUserLocation(true);
  };

  const handleDirections = () => {
    const originParam = userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : "";
    const nextWindow = window.open(
      `https://www.google.com/maps/dir/?api=1${originParam}&destination=${reebsLocation.lat},${reebsLocation.lng}`,
      "_blank",
      "noopener,noreferrer"
    );
    if (nextWindow) {
      nextWindow.opener = null;
    }
  };

  if (!apiKey) {
    return <p>Google Maps API key missing. Add VITE_GOOGLE_MAPS_KEY to your .env and restart the app.</p>;
  }

  return (
    <LoadScript
      googleMapsApiKey={apiKey}
      loadingElement={<p>Loading map…</p>}
      onError={(e) => setScriptError(e?.error?.message || "Error loading Google Maps")}
    >
      {scriptError ? (
        <div className="map-fallback">
          <p>Unable to load the map right now.</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${reebsLocation.lat},${reebsLocation.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Google Maps
          </a>
        </div>
      ) : (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={reebsLocation}
          zoom={14}
          options={mapOptions}
          onLoad={(map) => setMapInstance(map)}
          onUnmount={() => setMapInstance(null)}
        >
          {/* REEBS marker */}
          <Marker
            position={reebsLocation}
            onClick={() => setSelected({ name: "REEBS Party Themes", position: reebsLocation })}
          />

          {/* User marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                url: USER_MARKER_ICON_URL
              }}
            />
          )}

          {/* InfoWindow for REEBS */}
          {selected && (
            <InfoWindow
              position={selected.position}
              onCloseClick={() => setSelected(null)}
            >
              <div style={{ minWidth: "220px", display: "grid", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", color: "#111" }}>{selected.name}</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#444" }}>Sakumono Broadway, Tema</p>
                </div>
                <span
                  style={{
                    fontSize: "0.85rem",
                    padding: "4px 8px",
                    background: isOpen ? "rgba(230, 57, 70, 0.12)" : "rgba(0,0,0,0.08)",
                    color: isOpen ? "#d62839" : "#444",
                    borderRadius: "999px",
                    fontWeight: 700,
                    whiteSpace: "nowrap"
                  }}
                >
                  {isOpen ? "Open now" : "Closed"}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#555" }}>All times in GMT</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button
                    style={primaryActionButtonStyle}
                    onClick={handleDirections}
                  >
                    Get directions
                  </button>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <a href="tel:+233244238419" style={secondaryActionButtonStyle}>Call</a>
                    <a href="https://wa.me/233244238419" target="_blank" rel="noopener noreferrer" style={secondaryActionButtonStyle}>WhatsApp</a>
                  </div>
                </div>
              </div>
            </InfoWindow>
          )}

          {/* Controls */}
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              right: "16px",
              display: "flex",
              gap: "8px",
              background: "rgba(255,255,255,0.9)",
              padding: "10px 12px",
              borderRadius: "12px",
              boxShadow: "0 12px 24px rgba(0,0,0,0.15)",
              zIndex: 5
            }}
          >
            <button type="button" onClick={focusShop} style={controlButtonStyle}>
              Focus shop
            </button>
            <button
              type="button"
              onClick={focusUser}
              disabled={geoStatus === "requesting" || geoStatus === "unsupported"}
              style={controlButtonStyle}
            >
              {geoStatus === "requesting" ? "Locating..." : "Use my location"}
            </button>
          </div>
        </GoogleMap>
      )}
    </LoadScript>
  );
}

export default MapComponent;

const controlButtonStyle = {
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: "10px",
  padding: "8px 10px",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700
};

const primaryActionButtonStyle = {
  padding: "10px 12px",
  borderRadius: "10px",
  background: "linear-gradient(135deg, #ff7b7b, #e63946)",
  border: "none",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "center"
};

const secondaryActionButtonStyle = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid rgba(0,0,0,0.1)",
  background: "#fff",
  color: "#111",
  fontWeight: 700,
  textDecoration: "none",
  textAlign: "center"
};
