import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo';
import { articles } from '../content/blogPosts';
import '../styles/pages/Blog.css';

const getArticleKey = (article) => article.cta?.href || article.title;

const parseDateValue = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatPublishedDate = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return 'Date TBD';
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const sortArticlesByDate = (a, b) => {
  const aDate = parseDateValue(a.date);
  const bDate = parseDateValue(b.date);
  if (!aDate && !bDate) return 0;
  if (!aDate) return 1;
  if (!bDate) return -1;
  return bDate - aDate;
};

function BlogPreviewImage({ article }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [article?.image, article?.title]);

  if (!article || !article.image || hasError) {
    return (
      <div className="blog-preview__placeholder" role="img" aria-label="Blog image placeholder">
        <span>Add blog image</span>
      </div>
    );
  }

  return (
    <img
      src={article.image}
      alt={article.title}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

function BlogAccordionList({ posts, previewKey, onPreviewChange }) {
  if (!posts.length) {
    return (
      <p className="blog-accordion__empty">
        No blog posts for this filter yet.
      </p>
    );
  }

  return (
    <ul className="blog-accordion__list">
      {posts.map((post) => {
        const key = getArticleKey(post);
        const isActive = key === previewKey;
        const href = post.cta?.href;

        const sharedHandlers = {
          onMouseEnter: () => onPreviewChange(key),
          onFocus: () => onPreviewChange(key),
          onClick: () => onPreviewChange(key),
          onTouchStart: () => onPreviewChange(key),
        };

        const content = (
          <>
            <span className="blog-accordion__title">{post.title}</span>
            <time className="blog-accordion__date" dateTime={post.date}>
              {formatPublishedDate(post.date)}
            </time>
          </>
        );

        return (
          <li className={`blog-accordion__item${isActive ? ' is-active' : ''}`} key={key}>
            {href ? (
              <Link className="blog-accordion__trigger" to={href} {...sharedHandlers}>
                {content}
              </Link>
            ) : (
              <button className="blog-accordion__trigger" type="button" {...sharedHandlers}>
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Blog({ embedded = false, sectionId }) {
  const sortedArticles = useMemo(() => [...articles].sort(sortArticlesByDate), []);
  const availableFilters = useMemo(() => {
    const tagCounts = new Map();
    sortedArticles.forEach((post) => {
      (post.tags || []).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    return ['All', ...topTags];
  }, [sortedArticles]);

  const [activeFilter, setActiveFilter] = useState('All');
  const [previewKey, setPreviewKey] = useState(
    () => (sortedArticles[0] ? getArticleKey(sortedArticles[0]) : ''),
  );

  const filteredArticles = useMemo(() => {
    if (activeFilter === 'All') return sortedArticles;
    return sortedArticles.filter((post) => post.tags?.includes(activeFilter));
  }, [activeFilter, sortedArticles]);

  useEffect(() => {
    if (!filteredArticles.length) {
      setPreviewKey('');
      return;
    }

    const hasCurrentPreview = filteredArticles.some((post) => getArticleKey(post) === previewKey);
    if (!hasCurrentPreview) {
      setPreviewKey(getArticleKey(filteredArticles[0]));
    }
  }, [filteredArticles, previewKey]);

  const previewArticle = useMemo(
    () => filteredArticles.find((post) => getArticleKey(post) === previewKey) || filteredArticles[0] || null,
    [filteredArticles, previewKey],
  );

  const WrapperTag = embedded ? 'section' : 'main';

  return (
    <WrapperTag
      id={sectionId || (!embedded ? 'main-content' : undefined)}
      tabIndex={!embedded ? '-1' : undefined}
      className="blog-page"
    >
      {!embedded && (
        <Seo
          title="Blog | By Nana"
          description="Thoughts, project notes, and practical playbooks from Nana Aba."
          path="/blog"
        />
      )}

      <div className="blog-layout" data-scroll-reveal="fadeInUp">
        <aside className="blog-meta" aria-label="Blog metadata">
          <p className="blog-meta__eyebrow">Blog index</p>
          <h1 className="blog-meta__title">Blog posts</h1>

          <dl className="blog-meta__stats">
            <div>
              <dt>Total posts</dt>
              <dd>{sortedArticles.length}</dd>
            </div>
            <div>
              <dt>Visible now</dt>
              <dd>{filteredArticles.length}</dd>
            </div>
            <div>
              <dt>Active filter</dt>
              <dd>{activeFilter}</dd>
            </div>
          </dl>

          <figure className="blog-preview" aria-label="Blog post preview image">
            <div className="blog-preview__frame">
              <BlogPreviewImage article={previewArticle} />
            </div>
            {previewArticle ? (
              <figcaption className="blog-preview__caption">
                <p>{previewArticle.title}</p>
                <span>{formatPublishedDate(previewArticle.date)}</span>
              </figcaption>
            ) : null}
          </figure>
        </aside>

        <section className="blog-accordion" aria-label="Blog accordion">
          <div className="blog-meta__filters blog-accordion__filters" role="group" aria-label="Blog filters">
            {availableFilters.map((filter) => (
              <button
                key={filter}
                className={`blog-filter${activeFilter === filter ? ' is-active' : ''}`}
                type="button"
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          <BlogAccordionList posts={filteredArticles} previewKey={previewKey} onPreviewChange={setPreviewKey} />
        </section>
      </div>
    </WrapperTag>
  );
}

export default Blog;
