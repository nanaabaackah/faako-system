import React from 'react';
import { HiArrowRight } from 'react-icons/hi2';

const suggestions = [
  {
    id: 'projects',
    title: 'Projects',
    summary: 'Dive into visual case studies across ERP builds, operations tooling, and product systems.',
    href: '/projects',
    cta: 'Explore projects',
    image: '/imgs/projects/website-case.png',
  },
  {
    id: 'about',
    title: 'About',
    summary: 'How I approach discovery, design decisions, and shipping reliable systems.',
    href: '/about',
    cta: 'Read story',
    image: '/imgs/IMG_9495.JPG',
  },
  {
    id: 'blog',
    title: 'Blog',
    summary: 'Field notes on delivery, automation, and real-world project execution.',
    href: '/blog',
    cta: 'Read notes',
    image: '/imgs/article2.png',
  },
  {
    id: 'contact',
    title: 'Contact',
    summary: 'Book a call or send context for your project, role, or collaboration idea.',
    href: '/contact?topic=Collaboration',
    cta: 'Get in touch',
    image: '/imgs/projects/booking-case.png',
  },
];

function pickSuggestion(current = '') {
  const currentIndex = suggestions.findIndex((item) => item.id === current);
  if (currentIndex === -1) return suggestions[0];
  return suggestions[(currentIndex + 1) % suggestions.length];
}

function ExploreMore({ current }) {
  const suggestion = pickSuggestion(current);

  return (
    <section className="explore-more" aria-labelledby="explore-more-heading" data-scroll-reveal="fadeInUp">
      <div className="explore-more__inner ui-panel">
        <a className="explore-more__card" href={suggestion.href}>
          <div className="explore-more__visual ui-media" aria-hidden="true">
            <img src={suggestion.image} alt="" loading="lazy" />
          </div>
          <div className="explore-more__body">
            <p className="ui-kicker">Up next</p>
            <h2 id="explore-more-heading">{suggestion.title}</h2>
            <p>{suggestion.summary}</p>
            <span className="explore-more__cta">
              {suggestion.cta}
              <HiArrowRight size={16} aria-hidden="true" />
            </span>
          </div>
        </a>
      </div>
    </section>
  );
}

export default ExploreMore;
