import React, { useEffect } from "react";

interface ExternalRedirectProps {
  to: string;
}

const ExternalRedirect: React.FC<ExternalRedirectProps> = ({ to }) => {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <main className="stroane-surface-redirect">
      <p>Redirecting...</p>
      <a href={to}>Continue</a>
    </main>
  );
};

export default ExternalRedirect;

