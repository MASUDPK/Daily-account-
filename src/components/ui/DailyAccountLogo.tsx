import React from 'react';

interface DailyAccountLogoProps {
  variant?: 'stacked' | 'horizontal' | 'mark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Approved Daily Account Brand Logo:
 * - Three large vertical bars (Red on both sides, Navy Blue in the middle)
 * - Simple curved red and navy underline
 * - Straight, bold, black "Daily Account" text
 * - White / off-white surface background
 */
export const DailyAccountLogo: React.FC<DailyAccountLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
}) => {
  const markSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-[15px]',
    md: 'text-[18px]',
    lg: 'text-[22px]',
  };

  const markSvg = (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${markSizes[size]} shrink-0`}
      aria-hidden="true"
    >
      {/* White / Off-white background */}
      <rect width="64" height="64" rx="10" fill="#FAFBFD" />

      {/* Three large vertical bars: Red on both sides, Navy Blue in the middle */}
      <rect x="13" y="16" width="9" height="27" rx="1.5" fill="#C81E2B" />
      <rect x="27.5" y="10" width="9" height="33" rx="1.5" fill="#0F294A" />
      <rect x="42" y="18" width="9" height="25" rx="1.5" fill="#C81E2B" />

      {/* Simple curved red and navy underline */}
      <path
        d="M11 49.5C22 45.5 42 45.5 53 49.5"
        stroke="#0F294A"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M15 53.5C25 50.5 39 50.5 49 53.5"
        stroke="#C81E2B"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );

  if (variant === 'mark') {
    return <span className={`inline-flex items-center ${className}`}>{markSvg}</span>;
  }

  if (variant === 'stacked') {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center rounded-xl bg-[#FAFBFD] px-4 py-3 ${className}`}
      >
        {markSvg}
        <span
          className={`mt-1.5 font-bold tracking-tight text-black leading-none whitespace-nowrap ${textSizes[size]}`}
        >
          Daily Account
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-xl bg-[#FAFBFD] px-2.5 py-1.5 ${className}`}
    >
      {markSvg}
      <span
        className={`font-bold tracking-tight text-black leading-none whitespace-nowrap ${textSizes[size]}`}
      >
        Daily Account
      </span>
    </div>
  );
};
