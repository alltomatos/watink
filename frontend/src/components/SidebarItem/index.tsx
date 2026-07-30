/* @jsxImportSource react */
import React from "react";
import { NavLink, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { useThemeContext } from "../../context/DarkMode";

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
  activeColor?: string;
}

// Pré-computa classes fora do JSX para evitar ambiguidade do parser TSX com hsl(var(--...))
const getLinkClass = (isLightSidebar: boolean, isActive: boolean, collapsed: boolean): string => {
  const base = "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative select-none";
  const hover = isLightSidebar
    ? "hover:bg-black/5 hover:text-[var(--text-primary)]"
    : "hover:bg-white/5 hover:text-white";
  const state = isActive
    ? isLightSidebar
      ? "bg-[var(--action-primary-bg)] text-[var(--action-primary)] font-semibold"
      : "bg-primary/20 text-white font-semibold"
    : isLightSidebar
      ? "text-[var(--text-secondary)]"
      : "text-[var(--slate-300)]";
  const layout = collapsed ? "justify-center px-2" : "";
  return cn(base, hover, state, layout);
};

const getIconClass = (isLightSidebar: boolean, isActive: boolean): string => {
  const base = "flex shrink-0 items-center justify-center transition-transform group-hover:scale-110";
  const color = isActive
    ? isLightSidebar ? "text-[var(--action-primary)]" : "text-white"
    : isLightSidebar
      ? "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
      : "text-[var(--slate-400)] group-hover:text-white";
  return cn(base, color);
};

const SidebarItem: React.FC<SidebarItemProps> = ({
  to,
  icon,
  label,
  collapsed = false,
  activeColor = "var(--primary)",
}) => {
  const location = useLocation();
  const { appTheme } = useThemeContext();
  const isLightSidebar = appTheme === "whatsapp";
  const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const linkClass = getLinkClass(isLightSidebar, isActive, collapsed);
  const iconClass = getIconClass(isLightSidebar, isActive);

  const content = (
    <NavLink to={to} className={linkClass}>
      {/* Active Indicator */}
      {isActive && (
        <div
          className="absolute left-0 w-[3px] h-6 rounded-r-full"
          style={{ backgroundColor: activeColor || "var(--color-info)" }}
        />
      )}

      <div className={iconClass}>
        {icon}
      </div>

      {!collapsed && (
        <span className="text-sm truncate animate-in fade-in slide-in-from-left-2 duration-300">
          {label}
        </span>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="right" className="font-semibold">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};

export default SidebarItem;
