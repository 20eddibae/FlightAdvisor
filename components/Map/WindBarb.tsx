import React from 'react';

interface WindBarbProps {
  speed: number; // knots
  direction: number; // degrees (meteorological - direction wind is FROM)
}

export const WindBarb: React.FC<WindBarbProps> = ({ speed, direction }) => {
  // Round to nearest 5 for standard barb representation
  const roundedSpeed = Math.round(speed / 5) * 5;

  // Calculate parts
  const pennants = Math.floor(roundedSpeed / 50);
  const remainingAfterPennants = roundedSpeed % 50;
  const longBarbs = Math.floor(remainingAfterPennants / 10);
  const shortBarbs = remainingAfterPennants % 10 === 5 ? 1 : 0;

  // SVG parameters
  const shaftLength = 35;
  const barbLength = 10;
  const pennantWidth = 6;
  const spacing = 4;
  
  // Generate path commands
  let d = `M 0 0 L 0 ${-shaftLength}`; // Main shaft
  
  let currentY = -shaftLength;

  // Add Pennants (50kt)
  for (let i = 0; i < pennants; i++) {
    d += ` M 0 ${currentY} L ${barbLength} ${currentY + pennantWidth / 2} L 0 ${currentY + pennantWidth} Z`;
    currentY += spacing + 2; // Pennants take more space
  }

  // Add Long Barbs (10kt)
  for (let i = 0; i < longBarbs; i++) {
    d += ` M 0 ${currentY} L ${barbLength} ${currentY - 2}`; // Slanted up slightly for style
    currentY += spacing;
  }

  // Add Short Barb (5kt)
  if (shortBarbs > 0) {
    // If it's the only barb, place it a bit down so it doesn't look like an extension of the shaft
    const offset = (pennants === 0 && longBarbs === 0) ? 4 : 0; 
    d += ` M 0 ${currentY + offset} L ${barbLength / 2} ${currentY + offset - 1}`;
  }
  
  // Gusts or calm? 
  // If speed < 5, maybe just a circle? 
  // Standard is a circle for calm, but usually 0-2kts.
  const isCalm = speed < 3;

  return (
    <div
      style={{
        width: '80px',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width="80"
        height="80"
        viewBox="-40 -40 80 80"
        style={{
          overflow: 'visible',
          // Wind barbs point in direction wind is FROM
          // Shaft points up initially (negative Y), so rotate by wind direction
          transform: `rotate(${direction}deg)`
        }}
      >
        {isCalm ? (
          <circle cx="0" cy="0" r="4" fill="none" stroke="black" strokeWidth="2" />
        ) : (
          <g>
             {/* Station Circle at origin */}
             <circle cx="0" cy="0" r="2" fill="black" />

             {/* Wind barb shaft and barbs - barbs extend to the right (positive X) */}
             <path d={d} fill="black" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>

      {/* Debug label - uncomment to see wind speed and direction */}
      {/* <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', fontSize: '10px', fontWeight: 'bold', background: 'rgba(255,255,255,0.9)', padding: '1px 3px', borderRadius: '2px', whiteSpace: 'nowrap' }}>{Math.round(speed)}kt @ {Math.round(direction)}°</div> */}
    </div>
  );
};
