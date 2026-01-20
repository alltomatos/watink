import React from "react";
import { Paper, makeStyles } from "@material-ui/core";
import Grid from "@material-ui/core/Grid";
import Chart from "../../../pages/Dashboard/Chart";

const useStyles = makeStyles((theme) => ({
  fixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: 240,
  },
}));

const AttendanceChart = () => {
  const classes = useStyles();

  return (
    <Grid item xs={12}>
      <Paper className={classes.fixedHeightPaper}>
        <Chart />
      </Paper>
    </Grid>
  );
};

export default AttendanceChart;
