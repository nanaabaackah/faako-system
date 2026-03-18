import React, { useState } from "react";
import Papa from "papaparse";
import { Link } from "react-router-dom";
import galleryImages from "/src/data/galleryImages.json"

export default function InstagramFeed() {
  //const [posts, setPosts] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  /*useEffect(() => {
    const sheetUrl =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPIRMd64886Y_7O6UXTTKhjHaXAsjqQTht0VQgiX5AgT3If31uQBvsmzNx0cyWGFajv4vKWUiLOHMw/pub?gid=0&single=true&output=csv";

    fetch(sheetUrl)
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          quoteChar: '"',
          escapeChar: '"',
          complete: (result) => {
            const sorted = result.data.sort(
              (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
            );
            setPosts(sorted);
          },
        });
      })
      .catch((err) => console.error("Error fetching posts:", err));
  }, []);*/

  return (
    <div className="instagram-feed">
      {/*<h2 className="info-back-heading">Our Highlights</h2>
      <div className="feed-grid">
        {posts.map((post, idx) => (
          <a
            key={idx}
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="post-card"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            {post.media_type === "VIDEO" ? (
              <video
                src={post.media_url}
                alt={post.caption || "Instagram video"}
              />
            ) : (
              <img
                src={post.media_url}
                alt={post.caption || "Instagram post"}
                loading="lazy"
              />
            )}
            <div className="instagram-caption">
              <p>{post.caption}</p>
              <span className="instagram-date">
                {new Date(post.timestamp).toLocaleDateString()}
              </span>
            </div>
          </a>
        ))}
      </div>
      <div className="instagram-footer">
        <a
          href="https://instagram.com/reebspartythemes_/"
          target="_blank"
          rel="noopener noreferrer"
          className="instagram-button"
        >
          View More on Instagram →
        </a>
      </div>*/}
      <div className="gallery-container">
        <h2 className="info-back-heading">Gallery</h2>
        <p>
            A peek into the beautiful moments we’ve helped create.
        </p>
        <div className="gallery-grid">
            {galleryImages.map((item, index) => (
            <div key={index} className="gallery-card">
                <img
                src={item.src}
                alt={item.title}
                onClick={() => setSelectedImage(item)}
                className="gallery-img"
                />
            </div>
            ))}
        </div>
        {selectedImage && (
            <div className="lightbox" onClick={() => setSelectedImage(null)}>
                <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                    <img src={selectedImage.src} alt={selectedImage.title} />
                    <h3>{selectedImage.title}</h3>
                    <p>{selectedImage.description}</p>
                    <button onClick={() => setSelectedImage(null)}>Close</button>
                </div>
            </div>
        )}
    </div>
    </div>
  );
}