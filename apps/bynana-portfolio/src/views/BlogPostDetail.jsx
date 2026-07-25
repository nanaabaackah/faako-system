import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi2';
import Seo from '../components/Seo';
import NextUpCta from '../components/NextUpCta';
import { articles } from '../content/blogPosts';
import { blogPostDetailsBySlug } from '../content/blogPostDetails';
import { formatSafeDate } from '../utils/date';
import '../styles/pages/BlogPostDetail.css';

const DEFAULT_DATE = '2025-01-01';

const BlogActionLink = ({ action, className = 'ui-button' }) => {
  const { label, href, external } = action;

  if (external) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer noopener">
        {label}
      </a>
    );
  }

  return (
    <Link className={className} to={href}>
      {label}
    </Link>
  );
};

function BlogMedia({ src, alt, label = 'Add image' }) {
  const [hasError, setHasError] = useState(false);
  const showPlaceholder = !src || hasError;

  return (
    <div className="blog-post__media">
      {showPlaceholder ? (
        <div className="blog-post__media-placeholder">
          <div>
            <strong>{label}</strong>
            <span>Placeholder for media asset</span>
          </div>
        </div>
      ) : (
        <img src={src} alt={alt} loading="lazy" onError={() => setHasError(true)} />
      )}
    </div>
  );
}

const renderSectionContent = (section) => (
  <>
    {section.paragraphs?.map((paragraph) => (
      <p key={paragraph}>{paragraph}</p>
    ))}

    {section.list?.length ? (
      <ul className="blog-post__list">
        {section.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ) : null}

    {section.cards?.length ? (
      <div className="blog-post__grid">
        {section.cards.map((card) => (
          <article className="blog-post__card" key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
            {card.tag ? <span className="blog-post__card-tag">{card.tag}</span> : null}
          </article>
        ))}
      </div>
    ) : null}

    {section.gallery?.length ? (
      <div className="blog-post__gallery">
        {section.gallery.map(({ src, alt }, index) => (
          <BlogMedia key={`${src}-${index}`} src={src} alt={alt} label="Add gallery image" />
        ))}
      </div>
    ) : null}
  </>
);

const getCoverImage = (postMeta, detail) => {
  if (postMeta?.image) return postMeta.image;

  const gallerySection = detail.sections.find((section) => section.gallery?.length);
  return gallerySection?.gallery?.[0]?.src || '';
};

function BlogPostDetail() {
  const { slug = '' } = useParams();
  const normalizedSlug = slug.toLowerCase();
  const detail = blogPostDetailsBySlug[normalizedSlug];

  if (!detail) {
    return (
      <main id="main-content" tabIndex="-1" className="blog-post">
        <div className="blog-post__shell">
          <header className="blog-post__hero" data-scroll-reveal="fadeInUp">
            <div className="blog-post__intro">
              <p className="blog-post__kicker">Not found</p>
              <h1>Blog post not found</h1>
              <p className="blog-post__summary">This post does not exist yet, or the URL changed.</p>
              <Link className="ui-button ui-button--primary" to="/blog">
                Back to blog
              </Link>
            </div>
          </header>
        </div>
      </main>
    );
  }

  const postPath = `/blog/${detail.slug}`;
  const postMeta = articles.find((item) => item.cta?.href === postPath);
  const postCover = getCoverImage(postMeta, detail);

  const blogPosts = articles.filter((item) => item.cta?.href?.startsWith('/blog/'));

  const currentIndex = blogPosts.findIndex((item) => item.cta?.href === postPath);
  const totalPosts = blogPosts.length;
  const nextPostIndex = currentIndex >= 0 && totalPosts ? (currentIndex + 1) % totalPosts : -1;
  const nextPost = nextPostIndex >= 0 ? blogPosts[nextPostIndex] : null;
  const copyrightYear = new Date().getFullYear();

  const quickFacts = detail.quickFacts?.length
    ? detail.quickFacts
    : [
        { label: 'Format', value: detail.eyebrow },
        { label: 'Published', value: formatSafeDate(postMeta?.date || DEFAULT_DATE) },
        { label: 'Read time', value: postMeta?.readTime || '5 min read' },
      ];

  return (
    <main id="main-content" tabIndex="-1" className="blog-post">
      <Seo
        title={detail.seo?.title}
        description={detail.seo?.description}
        path={detail.seo?.path}
        type="article"
      />

      <article className="blog-post__shell">
        <header className="blog-post__hero" data-scroll-reveal="fadeInUp">
          <div className="blog-post__intro">
            <Link className="blog-post__breadcrumb" to="/blog">
              <HiArrowLeft size={16} aria-hidden="true" />
              <span>Back to blog</span>
            </Link>

            <p className="blog-post__kicker">[{detail.eyebrow}]</p>
            <h1>{detail.title}</h1>
            <p className="blog-post__summary">{detail.summary}</p>

            <div className="blog-post__meta">
              <span>{postMeta?.readTime || '5 min read'}</span>
              <span aria-hidden="true">/</span>
              <time dateTime={postMeta?.date || DEFAULT_DATE}>{formatSafeDate(postMeta?.date || DEFAULT_DATE)}</time>
            </div>

            <ul className="blog-post__tags" aria-label="Post tags">
              {detail.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </div>

          <div className="blog-post__hero-media">
            <BlogMedia src={postCover} alt={detail.title} label="Add post cover" />
          </div>
        </header>

        <dl className="blog-post__facts" data-scroll-reveal="fadeInUp">
          {quickFacts.slice(0, 4).map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="blog-post__body">
          {detail.sections.map((section, index) => (
            <section
              className="blog-post__section"
              aria-labelledby={section.id}
              key={section.id}
              data-scroll-reveal="fadeInUp"
            >
              <div className="blog-post__section-head">
                <p className="blog-post__section-index">[{String(index + 1).padStart(2, '0')}]</p>
                <h2 id={section.id}>{section.title}</h2>
              </div>
              <div className="blog-post__section-content">{renderSectionContent(section)}</div>
            </section>
          ))}
        </div>

        {nextPost ? (
          <NextUpCta
            className="blog-post__next-up"
            eyebrow="Next Post"
            title={nextPost.title}
            href={nextPost.cta?.href || '/blog'}
            imageSrc={nextPost.image}
            imageAlt={`${nextPost.title} preview`}
            placeholderLabel="Add next post image"
            leftLabel="Collection of Writing"
            rightLabel={`Copyright ${copyrightYear}`}
          />
        ) : null}
      </article>
    </main>
  );
}

export default BlogPostDetail;
