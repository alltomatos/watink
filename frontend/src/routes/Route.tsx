import React, { useContext } from "react";
import { Navigate } from "react-router";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";

interface PrivateRouteProps {
  children: React.ReactNode;
  isPrivate?: boolean;
  isPublic?: boolean;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({
  children,
  isPrivate = false,
  isPublic = false,
}) => {
  const { isAuth, loading } = useContext(AuthContext);

  if (loading) return <BackdropLoading />;
  if (isPrivate && !isAuth) return <Navigate to="/login" replace />;
  if (!isPrivate && !isPublic && isAuth) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default PrivateRoute;
