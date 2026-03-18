import { useEffect, useMemo, useRef } from 'react';

const GIST_ID_PATTERN = /^(?:[a-z0-9-]+\/)?[a-f0-9]{5,64}(?:\?file=[a-z0-9._-]+)?$/i;

const buildGistScriptUrl = (gistId) => {
  const normalized = String(gistId || '').trim();
  if (!GIST_ID_PATTERN.test(normalized)) return '';
  return `https://gist.github.com/${normalized}.js`;
};

function GistEmbed({ gistId }) {
  const containerRef = useRef(null);
  const scriptUrl = useMemo(() => buildGistScriptUrl(gistId), [gistId]);

  useEffect(() => {
    const gistContainer = containerRef.current;
    if (!gistContainer || !scriptUrl) return undefined;

    const gistScript = document.createElement('script');
    gistScript.src = scriptUrl;
    gistScript.async = true;
    gistContainer.replaceChildren();
    gistContainer.appendChild(gistScript);

    return () => {
      gistContainer.replaceChildren();
    };
  }, [scriptUrl]);

  if (!scriptUrl) return null;

  return <div ref={containerRef}></div>;
}

export default GistEmbed;
