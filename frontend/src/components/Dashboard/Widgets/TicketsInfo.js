import React from "react";
import { Grid } from "@material-ui/core";
import {
  Assignment,
  HourglassEmpty,
  CheckCircle
} from "@material-ui/icons";

import MetricCard from "../../../components/MetricCard";
import { i18n } from "../../../translate/i18n";
import useTickets from "../../../hooks/useTickets";

const TicketsInfo = ({ userQueueIds }) => {

  const GetTickets = (status, showAll, withUnreadMessages) => {
    const { count } = useTickets({
      status: status,
      showAll: showAll,
      withUnreadMessages: withUnreadMessages,
      queueIds: JSON.stringify(userQueueIds),
    });
    return count;
  };

  return (
    <React.Fragment>
      <Grid item xs={12} sm={6} md={4}>
        <MetricCard
          label={i18n.t("dashboard.messages.inAttendance.title")}
          value={GetTickets("open", "true", "false")}
          icon={<Assignment />}
          color="primary"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <MetricCard
          label={i18n.t("dashboard.messages.waiting.title")}
          value={GetTickets("pending", "true", "false")}
          icon={<HourglassEmpty />}
          color="warning"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <MetricCard
          label={i18n.t("dashboard.messages.closed.title")}
          value={GetTickets("closed", "true", "false")}
          icon={<CheckCircle />}
          color="success"
        />
      </Grid>
    </React.Fragment>
  );
};

export default TicketsInfo;
