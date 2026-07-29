/* @jsxImportSource react */
import React from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "../ui/avatar";
import { Card, CardContent } from "../ui/card";

interface ListItemCardProps {
    avatar?: string;
    title: string;
    subtitle?: string;
    status?: React.ReactNode;
    actions?: React.ReactNode;
    leading?: React.ReactNode;
    clickable?: boolean;
    onClick?: () => void;
    className?: string;
}

const ListItemCard: React.FC<ListItemCardProps> = ({
    avatar,
    title,
    subtitle,
    status,
    actions,
    leading,
    clickable,
    onClick,
    className
}) => {
    return (
        <Card
            className={cn(
                "group relative overflow-hidden transition-all duration-300",
                clickable && "cursor-pointer hover:-translate-y-1 hover:shadow-xl",
                className
            )}
            onClick={onClick}
        >
            <CardContent className="p-4 flex items-center gap-4">
                {leading && <div className="shrink-0" onClick={(e) => e.stopPropagation()}>{leading}</div>}
                <Avatar size="lg" src={avatar} name={title} />
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">
                            {title}
                        </h3>
                        {status && <div className="shrink-0">{status}</div>}
                    </div>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground truncate">
                            {subtitle}
                        </p>
                    )}
                </div>

                {actions && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {actions}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ListItemCard;
