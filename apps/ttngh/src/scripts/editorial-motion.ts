// Opt-in only: major editorial pairings, never legal copy, navigation or ScrollExpand.
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const pending = new Set<HTMLElement>();
const reveal = (element: HTMLElement) => {
  element.removeAttribute("data-reveal-pending");
  pending.delete(element);
};
const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    reveal(entry.target as HTMLElement);
    observer?.unobserve(entry.target);
  }
}, { threshold: 0.08 }) : null;
for (const element of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
  // Above-the-fold content is never delayed. No JS or unsupported observers = visible.
  if (!observer || motion.matches || element.getBoundingClientRect().top < innerHeight) continue;
  element.setAttribute("data-reveal-pending", "");
  pending.add(element); observer.observe(element);
  element.addEventListener("focusin", () => reveal(element), { once: true });
}
motion.addEventListener("change", () => {
  if (motion.matches) { pending.forEach(reveal); observer?.disconnect(); }
});
// Fail open even if observation stalls; images remain meaningful at 92% opacity.
setTimeout(() => pending.forEach(reveal), 8000);
for (const image of document.querySelectorAll<HTMLImageElement>("img[data-editorial-image][loading='lazy']")) {
  if (image.complete || motion.matches) continue;
  image.dataset.imagePending = "";
  const ready = () => image.removeAttribute("data-image-pending");
  image.addEventListener("load", ready, { once: true });
  image.addEventListener("error", ready, { once: true });
  setTimeout(ready, 8000);
}
