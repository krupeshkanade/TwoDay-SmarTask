
import React from 'react';

interface MagicWandProps {
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export const MagicWand: React.FC<MagicWandProps> = ({ onClick, isLoading, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300
        ${isLoading 
          ? 'bg-purple-100 text-purple-400 cursor-not-allowed' 
          : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg hover:shadow-purple-200 active:scale-95 disabled:opacity-50'
        }
      `}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className={isLoading ? 'animate-spin' : ''}
      >
        <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/>
        <path d="m14 7 3 3"/>
        <path d="M5 6v4"/>
        <path d="M19 14v4"/>
        <path d="M10 2v2"/>
        <path d="M7 8H3"/>
        <path d="M21 16h-4"/>
        <path d="M11 3H9"/>
      </svg>
      <span className="font-medium">{isLoading ? 'Crisping...' : 'Crisp It'}</span>
    </button>
  );
};
