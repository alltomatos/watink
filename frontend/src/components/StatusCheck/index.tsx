import React, { useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router";
import axios from "axios";
import SplashScreen from "../SplashScreen";
import { getBackendUrl } from "../../config";

interface StatusCheckProps {
  children: ReactNode;
}

const StatusCheck: React.FC<StatusCheckProps> = ({ children }) => {
  const [isBackendReady, setIsBackendReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const backendUrl = getBackendUrl();
        const base = backendUrl ? backendUrl.replace(/\/+$/, "") : "";
        const testUrl = base ? `${base}/api/v1/health` : "/api/v1/health";
        const setupCheckUrl = base
          ? `${base}/api/v1/initial-setup/check`
          : "/api/v1/initial-setup/check";

        await axios.get(testUrl, { timeout: 5000 });
        const { data } = await axios.get<{ needsSetup: boolean }>(setupCheckUrl);

        if (data.needsSetup && window.location.pathname !== "/initial-setup") {
          navigate("/initial-setup");
        }

        setIsBackendReady(true);
      } catch {
        setTimeout(checkBackend, 2000);
      }
    };

    checkBackend();
  }, [navigate]);

  if (!isBackendReady) return <SplashScreen />;
  return <>{children}</>;
};

export default StatusCheck;
