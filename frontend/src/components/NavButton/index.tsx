import React from "react";
import { Link, useLocation } from "react-router";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useThemeContext } from "../../context/DarkMode";

const ICON_THEME_COLORS: Record<string, string> = {
  dashboard:    "var(--nav-icon-blue)",
  pipelines:    "var(--nav-icon-purple)",
  tickets:      "var(--nav-icon-green)",
  contacts:     "var(--nav-icon-orange)",
  quickAnswers: "var(--nav-icon-purple)",
  flowBuilder:  "var(--nav-icon-blue)",
  clients:      "var(--nav-icon-blue)",
  helpdesk:     "var(--nav-icon-red)",
  myActivities: "var(--nav-icon-blue)",
  tags:         "var(--nav-icon-purple)",
  connections:  "var(--nav-icon-teal)",
  users:        "var(--nav-icon-blue)",
  access:       "var(--nav-icon-blue)",
  queues:       "var(--nav-icon-yellow)",
  knowledgeBase:"var(--nav-icon-orange)",
  settings:     "var(--nav-icon-red)",
  swagger:      "var(--nav-icon-pink)",
};

interface NavButtonProps {
  icon?: React.ReactElement;
  label?: string;
  primary?: string;
  to: string;
  collapsed?: boolean;
  iconTheme?: string;
}

const NavButton = ({ icon, label, primary, to, collapsed = false, iconTheme }: NavButtonProps) => {
  const location = useLocation();
  const isSelected = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
  const { appTheme } = useThemeContext();
  const isGoogleTheme = appTheme === "google";

  const displayText = label || primary || "";

  const resolvedColor = iconTheme && ICON_THEME_COLORS[iconTheme]
    ? ICON_THEME_COLORS[iconTheme]
    : null;

  const coloredIcon = isGoogleTheme && resolvedColor && icon
    ? React.cloneElement(icon, { style: { color: resolvedColor } } as React.HTMLAttributes<HTMLElement>)
    : icon;

  const item = (
    <motion.li whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} className="list-none">
      <Link
        to={to}
        aria-current={isSelected ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg transition-colors duration-fast",
          "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-alt)]/15",
          collapsed ? "justify-center p-3" : "px-4 py-3",
          isSelected && "bg-[var(--color-primary-bg)]/20 text-[var(--primary)] font-semibold"
        )}
      >
        {coloredIcon && (
          <span className={cn("shrink-0 flex items-center justify-center", collapsed ? "" : "w-5")}>
            {coloredIcon}
          </span>
        )}
        {!collapsed && (
          <span
            className={cn(
              "text-[0.9rem] tracking-[-0.01em]",
              appTheme === "apple" ? "font-semibold" : "font-medium"
            )}
          >
            {displayText}
          </span>
        )}
      </Link>
    </motion.li>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right">{displayText}</TooltipContent>
      </Tooltip>
    );
  }

  return item;
};

export default NavButton;
