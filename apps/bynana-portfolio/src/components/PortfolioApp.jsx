import { useEffect, useState } from 'react';
import App from '../App.jsx';

export default function PortfolioApp({ staticLocation }) {
  const [location, setLocation] = useState(staticLocation);

  useEffect(() => {
    setLocation(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  }, []);

  return <App staticLocation={location} />;
}
