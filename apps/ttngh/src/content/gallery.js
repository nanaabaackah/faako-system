import inventory from "./gallery.json" with { type: "json" };
const dimensions = {
  "asa-3.webp": [1067,1600], "asa-4.webp": [1600,1067],
  "nilee-3.webp": [1600,1067], "nilee-4.webp": [1143,1600],
  "asa-0.webp": [1067,1600], "asa-1.webp": [1067,1600], "asa-2.webp": [1600,1067],
  "nilee-0.webp": [1143,1600], "nilee-1.webp": [1067,1600], "nilee-2.webp": [1600,1143],
};
export const galleryAlbums = inventory.map(album => ({...album,photos:album.photos.map(photo => ({...photo,src:`/images/gallery/${photo.file}`,width:dimensions[photo.file][0],height:dimensions[photo.file][1]}))}));
export const galleryPhoto = file => galleryAlbums.flatMap(album => album.photos).find(photo => photo.file === file);
