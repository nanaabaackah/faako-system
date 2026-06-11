import React, { useEffect, useMemo, useState } from "react";

const normalizeGalleryItem = (entry) => {
  const payload = entry?.payload && typeof entry.payload === "object" ? entry.payload : entry;
  const src = payload?.src || payload?.imageUrl || payload?.mediaUrl || "";
  if (!src) return null;

  return {
    id: entry?.id || payload?.id || entry?.key || src,
    src,
    title: payload?.title || payload?.altText || "Gallery moment",
    description: payload?.description || payload?.caption || "",
  };
};

export default function InstagramFeed() {
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryStatus, setGalleryStatus] = useState("loading");
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    let active = true;

    const loadGallery = async () => {
      try {
        setGalleryStatus("loading");
        const response = await fetch("/api/websiteContent?section=gallery");
        if (!response.ok) {
          throw new Error(`Gallery request failed: ${response.status}`);
        }
        const data = await response.json();
        if (!active) return;
        const items = Array.isArray(data?.items)
          ? data.items.map(normalizeGalleryItem).filter(Boolean)
          : [];
        setGalleryItems(items);
        setGalleryStatus("ready");
      } catch (err) {
        if (!active) return;
        console.error("Error loading gallery:", err);
        setGalleryItems([]);
        setGalleryStatus("error");
      }
    };

    loadGallery();

    return () => {
      active = false;
    };
  }, []);

  const hasGalleryItems = useMemo(() => galleryItems.length > 0, [galleryItems]);

  return (
    <div className="instagram-feed">
      <div className="gallery-container">
        <h2 className="info-back-heading">Gallery</h2>
        <p>
            A peek into the beautiful moments we’ve helped create.
        </p>
        {galleryStatus === "loading" && <p>Loading gallery...</p>}
        {galleryStatus === "error" && <p>Gallery moments are unavailable right now.</p>}
        {galleryStatus === "ready" && !hasGalleryItems && <p>Gallery moments will be added soon.</p>}
        {hasGalleryItems && (
          <div className="gallery-grid">
              {galleryItems.map((item) => (
              <div key={item.id} className="gallery-card">
                  <img
                  src={item.src}
                  alt={item.title}
                  onClick={() => setSelectedImage(item)}
                  className="gallery-img"
                  loading="lazy"
                  />
              </div>
              ))}
          </div>
        )}
        {selectedImage && (
            <div className="lightbox" onClick={() => setSelectedImage(null)}>
                <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                    <img src={selectedImage.src} alt={selectedImage.title} />
                    <h3>{selectedImage.title}</h3>
                    <p>{selectedImage.description}</p>
                    <button type="button" onClick={() => setSelectedImage(null)}>Close</button>
                </div>
            </div>
        )}
    </div>
    </div>
  );
}
