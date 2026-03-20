/**
 * REEBS Party Themes - Frontend Enhancements
 * Scroll-based gradient animation and performance optimizations
 */

// ============================================================================
// SCROLL-BASED GRADIENT BACKGROUND
// ============================================================================

class GradientBackground {
  constructor() {
    this.body = document.body;
    this.lastScrollY = 0;
    this.ticking = false;
    
    // Only initialize if reduced motion is not preferred
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.init();
    }
  }
  
  init() {
    // Create the gradient element if it doesn't exist
    if (!this.body.querySelector('.gradient-bg')) {
      const gradientBg = document.createElement('div');
      gradientBg.className = 'gradient-bg';
      this.body.insertBefore(gradientBg, this.body.firstChild);
    }
    
    // Add scroll listener with throttling
    window.addEventListener('scroll', () => this.requestTick(), { passive: true });
    
    // Initial update
    this.update();
  }
  
  requestTick() {
    if (!this.ticking) {
      window.requestAnimationFrame(() => this.update());
      this.ticking = true;
    }
  }
  
  update() {
    const scrollY = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollY / documentHeight;
    
    // Calculate background position based on scroll
    // This creates the illusion of the gradient shifting as you scroll
    const bgPosition = scrollPercent * 200;
    
    // Update CSS custom property
    document.documentElement.style.setProperty('--scroll-gradient-position', `${bgPosition}%`);
    
    this.lastScrollY = scrollY;
    this.ticking = false;
  }
}

// ============================================================================
// BEE DECORATIONS ANIMATION
// ============================================================================

class BeeAnimations {
  constructor() {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.createBeeDecorations();
    }
  }
  
  createBeeDecorations() {
    // Only add if not already present
    if (document.querySelector('.bee-decoration')) return;
    
    const beeDecorations = [
      { class: 'bee-decoration--1', top: '15%', left: '5%' },
      { class: 'bee-decoration--2', bottom: '20%', right: '8%' }
    ];
    
    beeDecorations.forEach(config => {
      const bee = document.createElement('div');
      bee.className = `bee-decoration ${config.class}`;
      document.body.appendChild(bee);
    });
  }
}

// ============================================================================
// NAVBAR SCROLL BEHAVIOR
// ============================================================================

class NavbarScroll {
  constructor() {
    this.navbar = document.querySelector('.navbar');
    if (!this.navbar) return;
    
    this.lastScrollY = 0;
    this.ticking = false;
    this.scrollThreshold = 100;
    
    this.init();
  }
  
  init() {
    window.addEventListener('scroll', () => this.requestTick(), { passive: true });
    this.update();
  }
  
  requestTick() {
    if (!this.ticking) {
      window.requestAnimationFrame(() => this.update());
      this.ticking = true;
    }
  }
  
  update() {
    const scrollY = window.scrollY;
    
    // Add/remove scrolled class
    if (scrollY > 50) {
      this.navbar.classList.add('navbar-scrolled');
    } else {
      this.navbar.classList.remove('navbar-scrolled');
    }
    
    // Hide on scroll down, show on scroll up
    if (scrollY > this.lastScrollY && scrollY > this.scrollThreshold) {
      // Scrolling down
      this.navbar.classList.add('hide');
      this.navbar.classList.remove('show');
    } else if (scrollY < this.lastScrollY) {
      // Scrolling up
      this.navbar.classList.remove('hide');
      this.navbar.classList.add('show');
    }
    
    this.lastScrollY = scrollY;
    this.ticking = false;
  }
}

// ============================================================================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ============================================================================

class ScrollAnimations {
  constructor() {
    this.observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    this.init();
  }
  
  init() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => this.handleIntersection(entries),
        this.observerOptions
      );
      
      this.observeElements();
    }
  }
  
  observeElements() {
    const elements = document.querySelectorAll(`
      .feature-card,
      .service-card,
      .rental-card,
      .section-header,
      .hero-content > *
    `);
    
    elements.forEach(el => {
      // Don't re-observe if already animated
      if (!el.classList.contains('animated')) {
        this.observer.observe(el);
      }
    });
  }
  
  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Add animated class to prevent re-animation
        entry.target.classList.add('animated');
        
        // Trigger animation by adding 'in-view' class
        entry.target.classList.add('in-view');
        
        // Stop observing this element
        this.observer.unobserve(entry.target);
      }
    });
  }
}

// ============================================================================
// LAZY LOADING IMAGES
// ============================================================================

class LazyLoadImages {
  constructor() {
    this.images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      this.init();
    } else {
      // Fallback for older browsers
      this.loadAllImages();
    }
  }
  
  init() {
    const imageObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            this.loadImage(img);
            observer.unobserve(img);
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.01
      }
    );
    
    this.images.forEach(img => imageObserver.observe(img));
  }
  
  loadImage(img) {
    const src = img.getAttribute('data-src');
    if (!src) return;
    
    img.src = src;
    img.removeAttribute('data-src');
    img.classList.add('loaded');
  }
  
  loadAllImages() {
    this.images.forEach(img => this.loadImage(img));
  }
}

// ============================================================================
// BACK TO TOP BUTTON
// ============================================================================

class BackToTop {
  constructor() {
    this.button = document.querySelector('.back-to-top');
    if (!this.button) return;
    
    this.showThreshold = 500;
    this.ticking = false;
    
    this.init();
  }
  
  init() {
    window.addEventListener('scroll', () => this.requestTick(), { passive: true });
    this.button.addEventListener('click', () => this.scrollToTop());
    
    this.update();
  }
  
  requestTick() {
    if (!this.ticking) {
      window.requestAnimationFrame(() => this.update());
      this.ticking = true;
    }
  }
  
  update() {
    const scrollY = window.scrollY;
    
    if (scrollY > this.showThreshold) {
      this.button.classList.add('show');
    } else {
      this.button.classList.remove('show');
    }
    
    this.ticking = false;
  }
  
  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

class PerformanceMonitor {
  constructor() {
    if ('PerformanceObserver' in window) {
      this.observePerformance();
    }
  }
  
  observePerformance() {
    // Monitor Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // Silently fail if not supported
    }
    
    // Monitor First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach(entry => {
          console.log('FID:', entry.processingStart - entry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // Silently fail if not supported
    }
    
    // Monitor Cumulative Layout Shift (CLS)
    try {
      let clsScore = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            clsScore += entry.value;
            console.log('CLS:', clsScore);
          }
        }
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // Silently fail if not supported
    }
  }
}

// ============================================================================
// INITIALIZE ON DOM READY
// ============================================================================

function initReebsEnhancements() {
  // Initialize all enhancement classes
  new GradientBackground();
  new BeeAnimations();
  new NavbarScroll();
  new ScrollAnimations();
  new LazyLoadImages();
  new BackToTop();
  
  // Only monitor performance in development
  if (process.env.NODE_ENV === 'development') {
    new PerformanceMonitor();
  }
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReebsEnhancements);
} else {
  initReebsEnhancements();
}

// Export for module usage
export {
  GradientBackground,
  BeeAnimations,
  NavbarScroll,
  ScrollAnimations,
  LazyLoadImages,
  BackToTop,
  PerformanceMonitor
};
