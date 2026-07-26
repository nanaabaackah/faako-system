// Astro owns document metadata so it is present in the generated HTML. Keeping this
// compatibility component lets the existing React page components migrate without
// duplicating or mutating the document head after hydration.
function Seo() {
  return null;
}

export default Seo;
