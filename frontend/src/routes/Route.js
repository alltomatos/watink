import React, { useContext } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";

import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";

const Route = ({ component: Component, isPrivate = false, isPublic = false, ...rest }) => {
  const { isAuth, loading } = useContext(AuthContext);

  if (loading) {
    return <BackdropLoading />;
  }

  if (!isAuth && isPrivate) {
    return (
      <Redirect to={{ pathname: "/login", state: { from: rest.location } }} />
    );
  }

  if (isAuth && !isPrivate && !isPublic) {
    return (
      <Redirect to={{ pathname: "/", state: { from: rest.location } }} />
    );
  }

  return (
    <RouterRoute {...rest} component={Component} />
  );
};

export default Route;
