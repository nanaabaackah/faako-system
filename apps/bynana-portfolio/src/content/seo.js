import { articles } from './blogPosts.js';
import { blogPostDetails } from './blogPostDetails.js';
import { projectDetails } from './projectDetails.js';

export const SITE_URL = 'https://nanaabaackah.com';
export const SITE_NAME = 'By Nana';
export const DEFAULT_IMAGE = '/assets/bn-long.png';

export const staticPageSeo = {
  '/': {
    title: 'Nana Aba Ackah | Product Engineer, ERP & Automation',
    description:
      'Nana Aba Ackah designs and builds ERP, automation, SaaS, and operational web products. Explore selected systems, case studies, and practical writing.',
  },
  '/about': {
    title: 'About Nana Aba Ackah | Product Engineer & Systems Builder',
    description:
      'Meet Nana Aba Ackah, a product engineer combining UX, frontend engineering, ERP customization, automation, and operational systems thinking.',
    schemaType: 'ProfilePage',
  },
  '/resume': {
    title: 'Resume | Nana Aba Ackah',
    description:
      'Experience, capabilities, and selected outcomes from Nana Aba Ackah across product engineering, ERP, automation, UX, and technical delivery.',
  },
  '/projects': {
    title: 'ERP, Automation & Product Engineering Projects | By Nana',
    description:
      'Case studies covering ERP systems, operational tools, automation, ecommerce, internal platforms, and frontend product engineering by Nana Aba Ackah.',
  },
  '/blog': {
    title: 'Product Engineering, ERP & Automation Writing | By Nana',
    description:
      'Practical articles and field notes from Nana Aba Ackah on ERP delivery, automation, product engineering, UX, data, and reliable operations.',
  },
  '/contact': {
    title: 'Work With Nana Aba Ackah | Product Engineering & ERP',
    description:
      'Discuss a product, ERP, automation, operational workflow, or frontend engineering project with Nana Aba Ackah.',
  },
  '/privacy': {
    title: 'Privacy | By Nana',
    description: 'How nanaabaackah.com handles contact information, browser storage, cookies, and analytics preferences.',
  },
  '/404': {
    title: 'Page Not Found | By Nana',
    description: 'The requested page could not be found.',
    noIndex: true,
  },
};

const articleByPath = new Map(
  articles
    .filter((article) => article.cta?.href?.startsWith('/blog/'))
    .map((article) => [article.cta.href, article]),
);

export const projectSeoEntries = projectDetails
  .filter((project) => !project.hidden)
  .map((project) => ({
    slug: project.slug,
    path: `/projects/${project.slug}`,
    title: project.seo?.title || `${project.title} | By Nana`,
    description: project.seo?.description || project.summary,
    image: project.heroImage || DEFAULT_IMAGE,
    type: 'article',
    schemaType: 'CreativeWork',
    keywords: project.pills || [],
    name: project.title,
  }));

export const blogSeoEntries = blogPostDetails.map((post) => {
  const path = `/blog/${post.slug}`;
  const listing = articleByPath.get(path);

  return {
    slug: post.slug,
    path,
    title: post.seo?.title || `${post.title} | By Nana`,
    description: post.seo?.description || post.summary,
    image: listing?.image || DEFAULT_IMAGE,
    type: 'article',
    schemaType: 'BlogPosting',
    keywords: post.tags || [],
    name: post.title,
    datePublished: listing?.date,
    dateModified: listing?.updatedAt || listing?.date,
  };
});

const dynamicSeo = new Map(
  [...projectSeoEntries, ...blogSeoEntries].map((entry) => [entry.path, entry]),
);

export const getSeoForPath = (path) => dynamicSeo.get(path) || staticPageSeo[path] || staticPageSeo['/404'];

const absoluteUrl = (value) => new URL(value || DEFAULT_IMAGE, SITE_URL).toString();

export function buildStructuredData(path, seo) {
  const canonical = absoluteUrl(path);
  const personId = `${SITE_URL}/about#person`;
  const person = {
    '@type': 'Person',
    '@id': personId,
    name: 'Nana Aba Ackah',
    url: `${SITE_URL}/about`,
    image: absoluteUrl('/imgs/IMG_5131.JPG'),
    jobTitle: 'Product Engineer and Systems Builder',
    description:
      'Product engineer specializing in ERP, automation, operational UX, frontend systems, and SaaS delivery.',
    sameAs: [
      'https://www.linkedin.com/in/nana-aba-ackah/',
      'https://github.com/nanaabaackah/',
    ],
  };

  const graph = [
    person,
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: staticPageSeo['/'].description,
      publisher: { '@id': personId },
      inLanguage: 'en',
    },
  ];

  if (seo.schemaType === 'ProfilePage') {
    graph.push({
      '@type': 'ProfilePage',
      '@id': `${canonical}#profile`,
      url: canonical,
      name: seo.title,
      description: seo.description,
      mainEntity: { '@id': personId },
    });
  }

  if (seo.schemaType === 'BlogPosting') {
    graph.push({
      '@type': 'BlogPosting',
      '@id': `${canonical}#article`,
      url: canonical,
      headline: seo.name,
      description: seo.description,
      image: absoluteUrl(seo.image),
      datePublished: seo.datePublished,
      dateModified: seo.dateModified,
      author: { '@id': personId },
      publisher: { '@id': personId },
      keywords: seo.keywords.join(', '),
      mainEntityOfPage: canonical,
      inLanguage: 'en',
    });
  }

  if (seo.schemaType === 'CreativeWork') {
    graph.push({
      '@type': 'CreativeWork',
      '@id': `${canonical}#project`,
      url: canonical,
      name: seo.name,
      description: seo.description,
      image: absoluteUrl(seo.image),
      creator: { '@id': personId },
      keywords: seo.keywords.join(', '),
      inLanguage: 'en',
    });
  }

  if (path.startsWith('/projects/') || path.startsWith('/blog/')) {
    const isProject = path.startsWith('/projects/');
    const parentPath = isProject ? '/projects' : '/blog';
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        {
          '@type': 'ListItem',
          position: 2,
          name: isProject ? 'Projects' : 'Blog',
          item: absoluteUrl(parentPath),
        },
        { '@type': 'ListItem', position: 3, name: seo.name, item: canonical },
      ],
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
