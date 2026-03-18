import React from 'react';
import { Helmet } from 'react-helmet';

const BASE_URL = 'https://nanaabaackah.com';
const DEFAULT_IMAGE = `${BASE_URL}/assets/bn-long.png`;

const normalizePath = (path) => {
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
};

function Seo({ title, description, path = '', image = DEFAULT_IMAGE, type = 'website', noIndex = false }) {
  const resolvedPath = normalizePath(path);
  const url = `${BASE_URL}${resolvedPath}`;

  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:site_name" content="By Nana" />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
    </Helmet>
  );
}

export default Seo;
