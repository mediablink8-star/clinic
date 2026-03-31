import React from 'react';

const Skeleton = ({ width = '100%', height = '20px', borderRadius = '8px', className = '', style = {} }) => {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-loading 1.5s infinite linear',
        ...style
      }}
    />
  );
};

export default Skeleton;
