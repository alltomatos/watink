import React from "react";
import { ToastContainer } from "react-toastify";

import { useThemeContext } from "@/context/DarkMode";

/**
 * ToastContainer com tema atado ao dark mode do app — antes montado sem
 * nenhuma prop de tema, o que deixava os toasts sempre no visual claro
 * padrão do react-toastify mesmo com o resto da UI em dark mode.
 */
const ThemedToastContainer: React.FC = () => {
  const { darkMode } = useThemeContext();

  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      theme={darkMode ? "dark" : "light"}
      newestOnTop
    />
  );
};

export default ThemedToastContainer;
