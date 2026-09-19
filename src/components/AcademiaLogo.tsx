import React from 'react';

interface AcademiaLogoProps {
  className?: string;
  size?: number | string;
  isDark?: boolean;
}

export const AcademiaLogo: React.FC<AcademiaLogoProps> = ({
  className = "h-8 w-auto",
  size,
  isDark = false
}) => {
  return (
    <svg
      viewBox="50 14 116 158"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block flex-shrink-0 select-none ${className}`}
      style={size ? { height: size, width: 'auto' } : undefined}
      aria-label="AssignmentMinds Logo"
    >
      {/* Orange Head */}
      <circle
        cx="105"
        cy="30"
        r="14"
        fill="#FF4612"
      />

      {/* Dynamic Orange Figure with Raised Arm and Swoop Body */}
      <path
        d="M102 44 C106 44 113 41 119 33 C124 26 127 23 128 24 C128 25 125 34 118 47 C110 61 102 78 96 95 C89 115 85 136 86 160 C85 167 84 171 83 170 C82 169 80 151 83 131 C86 110 91 91 88 80 C85 69 74 75 63 83 C57 88 53 93 51 95 C51 93 54 84 63 73 C72 61 86 51 98 46 C100 45 101 44 102 44 Z"
        fill="#FF4612"
      />

      {/* Navy Stylized Letter A */}
      <path
        d="M128 47 L164 135 L141 135 L133 115 L102 115 L95 135 L74 135 C84 112 96 85 110 63 L119 47 Z M129 99 L118 72 C115 81 111 90 108 99 Z"
        fill={isDark ? "#FFFFFF" : "#1A2839"}
      />
    </svg>
  );
};
