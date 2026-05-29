import React, { type ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionButton?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionButton
}) => {
  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-state-icon">
          {icon}
        </div>
      )}
      <h3 className="empty-state-title">
        {title}
      </h3>
      <p className="empty-state-desc">
        {description}
      </p>
      {actionButton && (
        <div>
          {actionButton}
        </div>
      )}
    </div>
  );
};
