'use client';

import React from 'react';
import { ChevronDown, ChevronRight, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableBlockProps {
  title: string;
  subtitle?: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  color?: string;
  badge?: string | number | React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  isActive?: boolean;
  onRemove?: () => void;
  actions?: React.ReactNode;
}

export const ExpandableBlock: React.FC<ExpandableBlockProps> = ({
  title,
  subtitle,
  isExpanded,
  onToggle,
  children,
  color = '#3b82f6',
  badge,
  icon,
  className,
  headerClassName,
  contentClassName,
  isActive = false,
  onRemove,
  actions
}) => {
  return (
    <div 
      className={cn(
        "border rounded-lg overflow-hidden transition-all duration-200",
        isActive && "ring-2 ring-offset-2",
        className
      )}
      style={{
        borderColor: isActive ? color : undefined,
        '--block-color': color
      } as React.CSSProperties}
    >
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
          headerClassName
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="transition-transform duration-200">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </div>
          
          {icon || (
            <Circle 
              className="h-3 w-3 flex-shrink-0" 
              style={{ color, fill: color }} 
            />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{title}</div>
            {subtitle && (
              <div className="text-xs text-gray-500 truncate">{subtitle}</div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-2">
          {badge !== undefined && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800">
              {badge}
            </span>
          )}

          {actions}

          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div 
          className={cn(
            "border-t bg-gray-50/50 dark:bg-gray-900/50",
            contentClassName
          )}
          style={{ borderColor: color + '20' }}
        >
          <div className="p-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};