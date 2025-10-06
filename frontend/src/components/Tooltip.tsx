
import React, { useState } from 'react';
import type { ReactNode } from 'react';

type TooltipProps = {
  text: string;
  children: ReactNode;
};

export function Tooltip({ text, children }: TooltipProps) {
  const [isTooltipVisible, setTooltipVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
    >
      {children}
      {isTooltipVisible && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform rounded-md bg-gray-800 px-3 py-2 text-sm font-semibold text-white shadow-lg">
          {text}
          <div className="absolute left-1/2 top-full -translate-x-1/2 transform border-8 border-t-gray-800 border-l-transparent border-r-transparent border-b-transparent"></div>
        </div>
      )}
    </div>
  );
}
