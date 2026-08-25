const GROUPS = [
  {
    name: "faako-ui",
    patterns: [
      "/packages/ui/",
      "/packages/theme/",
    ],
  },
  {
    name: "faako-core",
    patterns: [
      "/packages/config/",
      "/packages/core/",
      "/packages/security/",
      "/packages/types/",
      "/packages/utils/",
    ],
  },
  {
    name: "icons-vendor",
    patterns: [
      "/node_modules/iconsax/",
      "/node_modules/iconsax-react/",
      "/node_modules/lucide-react/",
      "/node_modules/react-icons/",
    ],
  },
  {
    name: "motion-vendor",
    patterns: [
      "/node_modules/animejs/",
      "/node_modules/click-spark/",
      "/node_modules/framer-motion/",
      "/node_modules/react-tsparticles/",
      "/node_modules/tsparticles/",
    ],
  },
  {
    name: "legacy-ui-vendor",
    patterns: [
      "/node_modules/bootstrap/",
      "/node_modules/jquery/",
      "/node_modules/jquery.easing/",
      "/node_modules/react-bootstrap/",
      "/node_modules/stellar.js/",
      "/node_modules/waypoints/",
    ],
  },
  {
    name: "three-vendor",
    patterns: [
      "/node_modules/three/",
    ],
  },
  {
    name: "math-vendor",
    patterns: [
      "/node_modules/mathjs/",
    ],
  },
  {
    name: "maps-vendor",
    patterns: [
      "/node_modules/@react-google-maps/",
      "/node_modules/leaflet/",
      "/node_modules/react-leaflet/",
    ],
  },
  {
    name: "pdf-jspdf-vendor",
    patterns: [
      "/node_modules/jspdf/",
      "/node_modules/jspdf-autotable/",
    ],
  },
  {
    name: "pdf-render-vendor",
    patterns: [
      "/node_modules/dompurify/",
      "/node_modules/html2canvas/",
    ],
  },
];

const normalizePath = (value) => value.replaceAll("\\", "/");

export function createManualChunks() {
  return (id) => {
    const normalized = normalizePath(id);

    // Keep Vite's dynamic-import helper in the shared runtime. If Rollup places
    // it inside a heavy feature chunk, the entry imports and preloads that
    // feature even though the underlying dependency is otherwise on demand.
    if (normalized.includes("vite/preload-helper")) {
      return "vendor";
    }

    for (const group of GROUPS) {
      if (group.patterns.some((pattern) => normalized.includes(pattern))) {
        return group.name;
      }
    }

    if (normalized.includes("/node_modules/")) {
      return "vendor";
    }

    return undefined;
  };
}
