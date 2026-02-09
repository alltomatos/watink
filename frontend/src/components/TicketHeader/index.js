import React from "react";

import { Card, Button } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";
import ArrowBackIos from "@material-ui/icons/ArrowBackIos";
import { useHistory } from "react-router-dom";

const useStyles = makeStyles((theme) => ({
  ticketHeader: {
    display: "flex",
    backgroundColor: "#ffffff",
    flex: "none",
    borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
    zIndex: 1,
    [theme.breakpoints.down("sm")]: {
      flexWrap: "wrap",
    },
  },
}));

const TicketHeader = ({ loading, children }) => {
  const classes = useStyles();
  const history = useHistory();
  const handleBack = () => {
    history.push("/tickets");
  };

  return (
    <>
      {loading ? (
        <TicketHeaderSkeleton />
      ) : (
        <Card square className={classes.ticketHeader}>
          <Button color="primary" onClick={handleBack}>
            <ArrowBackIos />
          </Button>
          {children}
        </Card>
      )}
    </>
  );
};

export default TicketHeader;
