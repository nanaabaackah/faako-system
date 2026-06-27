import React from 'react';
import { AnimatedLoadingState } from '@faako/ui';

function Loader({ active = false }) {
  if (!active) return null;

  return (
    <AnimatedLoadingState
      page
      overlay
      variant="portfolio"
      title="Loading By Nana"
      message="Preparing the next view."
    />
  );
}

export default Loader;
