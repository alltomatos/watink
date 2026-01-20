import React, { useState, useEffect, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import { Modal, Typography, Button, Checkbox, FormControlLabel, IconButton } from "@material-ui/core";
import SettingsIcon from "@material-ui/icons/Settings";
import { ArrowUpward, ArrowDownward } from "@material-ui/icons";

import { AuthContext } from "../../context/Auth/AuthContext";
import TicketsInfo from "../../components/Dashboard/Widgets/TicketsInfo";
import AttendanceChart from "../../components/Dashboard/Widgets/AttendanceChart";
import api from "../../services/api";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  modalPaper: {
    position: 'absolute',
    width: 400,
    backgroundColor: theme.palette.background.paper,
    border: 'none',
    boxShadow: theme.shadows[5],
    padding: theme.spacing(2, 4, 3),
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    borderRadius: 8,
  },
  widgetConfigItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1),
    padding: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    borderRadius: 4,
  },
}));

const Dashboard = () => {
  const classes = useStyles();
  const { user, setUser } = useContext(AuthContext);
  const [widgets, setWidgets] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (user.configs && user.configs.dashboard && user.configs.dashboard.widgets) {
      setWidgets(user.configs.dashboard.widgets);
    } else {
      setWidgets([
        { id: "tickets_info", visible: true, width: 12, order: 1 },
        { id: "attendance_chart", visible: true, width: 12, order: 2 },
      ]);
    }
  }, [user]);

  const handleSaveConfigs = async () => {
    try {
      const newConfigs = {
        ...user.configs,
        dashboard: {
          widgets: widgets,
        },
      };

      await api.put(`/users/${user.id}/configs`, { configs: newConfigs });

      // Update local user context
      setUser({ ...user, configs: newConfigs });

      toast.success("Dashboard preferences saved!");
      setModalOpen(false);
    } catch (err) {
      toast.error("Error saving preferences");
    }
  };

  const toggleWidget = (id) => {
    setWidgets(widgets.map(w =>
      w.id === id ? { ...w, visible: !w.visible } : w
    ));
  };

  const moveWidget = (index, direction) => {
    const newWidgets = [...widgets].sort((a, b) => a.order - b.order);
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= newWidgets.length) return;

    // Swap orders
    const tempOrder = newWidgets[index].order;
    newWidgets[index].order = newWidgets[targetIndex].order;
    newWidgets[targetIndex].order = tempOrder;

    setWidgets(newWidgets);
  };

  let userQueueIds = [];
  if (user.queues && user.queues.length > 0) {
    userQueueIds = user.queues.map((q) => q.id);
  }

  const renderWidget = (widget) => {
    if (!widget.visible) return null;

    switch (widget.id) {
      case "tickets_info":
        return <TicketsInfo key={widget.id} userQueueIds={userQueueIds} />;
      case "attendance_chart":
        return <AttendanceChart key={widget.id} />;
      default:
        return null;
    }
  };

  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  return (
    <div>
      <Container maxWidth="lg" className={classes.container}>
        <Grid container spacing={3} style={{ marginBottom: 20 }}>
          <Grid item xs={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<SettingsIcon />}
              onClick={() => setModalOpen(true)}
            >
              Customize Dashboard
            </Button>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {sortedWidgets.map(renderWidget)}
        </Grid>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        >
          <div className={classes.modalPaper}>
            <Typography variant="h6" gutterBottom>Customize Dashboard</Typography>
            {sortedWidgets.map((widget, index) => (
              <div key={widget.id} className={classes.widgetConfigItem}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={widget.visible}
                      onChange={() => toggleWidget(widget.id)}
                      color="primary"
                    />
                  }
                  label={widget.id === 'tickets_info' ? 'Tickets Info' : 'Attendance Chart'}
                />
                <div>
                  <IconButton
                    size="small"
                    onClick={() => moveWidget(index, -1)}
                    disabled={index === 0}
                  >
                    <ArrowUpward />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => moveWidget(index, 1)}
                    disabled={index === sortedWidgets.length - 1}
                  >
                    <ArrowDownward />
                  </IconButton>
                </div>
              </div>
            ))}
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveConfigs}
              style={{ marginTop: 20 }}
              fullWidth
            >
              Save Preferences
            </Button>
          </div>
        </Modal>
      </Container>
    </div>
  );
};

export default Dashboard;
