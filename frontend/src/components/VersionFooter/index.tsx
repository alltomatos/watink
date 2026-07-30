/* @jsxImportSource react */
import React, { useContext } from "react";
import { Link as RouterLink } from "react-router";
import { AuthContext } from "../../context/Auth/AuthContext";

interface VersionFooterProps {
  collapsed?: boolean;
}

const VersionFooter: React.FC<VersionFooterProps> = ({ collapsed = false }) => {
  const { user } = useContext(AuthContext);
  const isSuperAdmin = (user as unknown as { alcance?: string })?.alcance === "plataforma";

  if (collapsed || !isSuperAdmin) {
    return null;
  }

  return (
    <RouterLink
      to="/monitor"
      className="no-underline text-xs font-semibold text-primary hover:underline truncate"
    >
      Monitor
    </RouterLink>
  );
};

export default VersionFooter;
