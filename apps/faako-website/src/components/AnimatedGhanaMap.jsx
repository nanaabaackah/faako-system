import { useRef } from 'react';

/**
 * ANIMATED GHANA MAP
 * ==================
 * Interactive SVG map of Ghana with regions that can be highlighted
 * Shows case study locations or client distribution
 */

export default function AnimatedGhanaMap({ 
  highlightedRegions = [], // ['accra', 'kumasi', 'takoradi']
  showPulse = true,
  className = "" 
}) {
  const mapRef = useRef(null);

  // Ghana regions with their major cities
  const regions = {
    accra: { name: "Greater Accra", city: "Accra", color: "#FF6B35" },
    kumasi: { name: "Ashanti", city: "Kumasi", color: "#F7931E" },
    takoradi: { name: "Western", city: "Takoradi", color: "#3498DB" },
    tamale: { name: "Northern", city: "Tamale", color: "#9B59B6" },
    cape_coast: { name: "Central", city: "Cape Coast", color: "#27AE60" },
  };

  return (
    <>
      <style>{`
        .ghana-map-container {
          position: relative;
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
        }

        .ghana-map {
          width: 100%;
          height: auto;
          display: block;
        }

        .ghana-map .region-path {
          fill: var(--surface-alt);
          stroke: var(--border);
          stroke-width: 1.5;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .ghana-map .region-path:hover {
          fill: color-mix(in srgb, var(--accent) 10%, transparent);
          stroke: var(--accent);
          stroke-width: 2;
        }

        .ghana-map .region-path.highlighted {
          fill: color-mix(in srgb, var(--accent) 20%, transparent);
          stroke: var(--accent);
          stroke-width: 2;
          animation: regionPulse 2s ease-in-out infinite;
        }

        @keyframes regionPulse {
          0%, 100% {
            fill-opacity: 0.2;
          }
          50% {
            fill-opacity: 0.4;
          }
        }

        .ghana-map .city-marker {
          fill: var(--accent);
          stroke: #fff;
          stroke-width: 2;
        }

        .ghana-map .city-marker.pulse {
          animation: markerPulse 2s ease-in-out infinite;
        }

        @keyframes markerPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
        }

        .ghana-map .city-label {
          font-size: 12px;
          font-weight: 600;
          fill: var(--ink);
          pointer-events: none;
        }

        .ghana-map .pulse-ring {
          fill: none;
          stroke: var(--accent);
          stroke-width: 2;
          opacity: 0;
          animation: pulseRing 2s ease-out infinite;
        }

        @keyframes pulseRing {
          0% {
            r: 8;
            opacity: 1;
          }
          100% {
            r: 20;
            opacity: 0;
          }
        }

        .map-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          justify-content: center;
          margin-top: 2rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
        }

        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--accent);
        }

        @media (prefers-reduced-motion: reduce) {
          .ghana-map .region-path.highlighted,
          .ghana-map .city-marker.pulse,
          .ghana-map .pulse-ring {
            animation: none;
          }
        }
      `}</style>

      <div className={`ghana-map-container ${className}`}>
        <svg
          ref={mapRef}
          className="ghana-map"
          viewBox="0 0 400 500"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Simplified Ghana map outline */}
          <g id="ghana-regions">
            
            {/* Northern Region */}
            <path
              className={`region-path ${highlightedRegions.includes('tamale') ? 'highlighted' : ''}`}
              d="M 150,50 L 250,50 L 270,100 L 260,150 L 200,170 L 140,150 L 130,100 Z"
              data-region="tamale"
            />

            {/* Ashanti Region (Kumasi) */}
            <path
              className={`region-path ${highlightedRegions.includes('kumasi') ? 'highlighted' : ''}`}
              d="M 140,150 L 200,170 L 260,150 L 270,200 L 240,250 L 160,250 L 130,200 Z"
              data-region="kumasi"
            />

            {/* Central Region (Cape Coast) */}
            <path
              className={`region-path ${highlightedRegions.includes('cape_coast') ? 'highlighted' : ''}`}
              d="M 130,200 L 160,250 L 180,300 L 140,320 L 100,290 L 90,240 Z"
              data-region="cape_coast"
            />

            {/* Greater Accra Region */}
            <path
              className={`region-path ${highlightedRegions.includes('accra') ? 'highlighted' : ''}`}
              d="M 160,250 L 240,250 L 260,300 L 240,350 L 180,350 L 180,300 Z"
              data-region="accra"
            />

            {/* Western Region (Takoradi) */}
            <path
              className={`region-path ${highlightedRegions.includes('takoradi') ? 'highlighted' : ''}`}
              d="M 90,240 L 100,290 L 140,320 L 180,350 L 150,400 L 80,380 L 60,320 Z"
              data-region="takoradi"
            />
          </g>

          {/* City markers with optional pulse */}
          <g id="city-markers">
            {/* Accra */}
            {highlightedRegions.includes('accra') && (
              <>
                {showPulse && (
                  <circle className="pulse-ring" cx="200" cy="300">
                    <animate attributeName="r" from="8" to="20" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="1" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle className={`city-marker ${showPulse ? 'pulse' : ''}`} cx="200" cy="300" r="8" />
                <text className="city-label" x="200" y="285" textAnchor="middle">Accra</text>
              </>
            )}

            {/* Kumasi */}
            {highlightedRegions.includes('kumasi') && (
              <>
                {showPulse && (
                  <circle className="pulse-ring" cx="200" cy="200">
                    <animate attributeName="r" from="8" to="20" dur="2s" begin="0.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="1" to="0" dur="2s" begin="0.5s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle className={`city-marker ${showPulse ? 'pulse' : ''}`} cx="200" cy="200" r="8" />
                <text className="city-label" x="200" y="185" textAnchor="middle">Kumasi</text>
              </>
            )}

            {/* Takoradi */}
            {highlightedRegions.includes('takoradi') && (
              <>
                {showPulse && (
                  <circle className="pulse-ring" cx="120" cy="350">
                    <animate attributeName="r" from="8" to="20" dur="2s" begin="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="1" to="0" dur="2s" begin="1s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle className={`city-marker ${showPulse ? 'pulse' : ''}`} cx="120" cy="350" r="8" />
                <text className="city-label" x="120" y="335" textAnchor="middle">Takoradi</text>
              </>
            )}

            {/* Tamale */}
            {highlightedRegions.includes('tamale') && (
              <>
                {showPulse && (
                  <circle className="pulse-ring" cx="200" cy="100">
                    <animate attributeName="r" from="8" to="20" dur="2s" begin="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="1" to="0" dur="2s" begin="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle className={`city-marker ${showPulse ? 'pulse' : ''}`} cx="200" cy="100" r="8" />
                <text className="city-label" x="200" y="85" textAnchor="middle">Tamale</text>
              </>
            )}

            {/* Cape Coast */}
            {highlightedRegions.includes('cape_coast') && (
              <>
                {showPulse && (
                  <circle className="pulse-ring" cx="140" cy="270">
                    <animate attributeName="r" from="8" to="20" dur="2s" begin="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="1" to="0" dur="2s" begin="2s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle className={`city-marker ${showPulse ? 'pulse' : ''}`} cx="140" cy="270" r="8" />
                <text className="city-label" x="140" y="255" textAnchor="middle">Cape Coast</text>
              </>
            )}
          </g>
        </svg>

        {/* Legend */}
        {highlightedRegions.length > 0 && (
          <div className="map-legend">
            {highlightedRegions.map(region => (
              <div key={region} className="legend-item">
                <div className="legend-dot" style={{ background: regions[region]?.color || 'var(--accent)' }}></div>
                <span>{regions[region]?.city || region}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * USAGE EXAMPLES:
 * 
 * // Show all regions
 * <AnimatedGhanaMap 
 *   highlightedRegions={['accra', 'kumasi', 'takoradi']}
 *   showPulse={true}
 * />
 * 
 * // Show only Accra
 * <AnimatedGhanaMap 
 *   highlightedRegions={['accra']}
 *   showPulse={true}
 * />
 * 
 * // No pulse animation
 * <AnimatedGhanaMap 
 *   highlightedRegions={['kumasi', 'accra']}
 *   showPulse={false}
 * />
 */
