/* @jsxImportSource react */
import React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "wt-page-layout flex flex-col h-full w-full overflow-hidden bg-background",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  children,
  className,
  ...props
}) => {
  return (
    <header
      className={cn(
        "wt-page-header flex items-center justify-between gap-4 px-6 py-4 border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10",
        className
      )}
      {...props}
    >
      {(title || description) && (
        <div className="flex flex-col min-w-0">
          {title && (
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{description}</p>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {children}
      </div>
    </header>
  );
};

interface PageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const PageContent: React.FC<PageContentProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <main
      className={cn(
        "wt-page-content flex-1 overflow-y-auto overflow-x-hidden p-6",
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
};
