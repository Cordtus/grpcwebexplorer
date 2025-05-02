// components/LoadingSpinner.tsx
import React from 'react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    color = '#0a84ff'
}) => {
    // Size mapping
    const sizeMap = {
        sm: '16px',
        md: '24px',
        lg: '32px'
    };

    const spinnerSize = sizeMap[size];

    return (
        <div className="flex items-center justify-center">
        <div
        className="animate-spin rounded-full border-t-transparent"
        style={{
            width: spinnerSize,
            height: spinnerSize,
            borderWidth: '2px',
            borderColor: color,
            borderTopColor: 'transparent'
        }}
        />
        </div>
    );
};

export default LoadingSpinner;
