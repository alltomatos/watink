import React from "react";
import MainLayoutDefault from "./MainLayoutDefault";
import MainLayoutSaaS from "./MainLayoutSaaS";
import { useThemeContext } from "../context/DarkMode";

const LoggedInLayout = ({ children }) => {
  const { appTheme } = useThemeContext();

  // If theme is 'saas', render the new SaaS Layout
  if (appTheme === "saas") {
    return <MainLayoutSaaS>{children}</MainLayoutSaaS>;
  }

  // Otherwise, fallback to the default Material drawer layout
  return <MainLayoutDefault>{children}</MainLayoutDefault>;
};

export default LoggedInLayout;
