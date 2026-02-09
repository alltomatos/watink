import React, { useState, useEffect } from "react";
import {
  makeStyles,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Box
} from "@material-ui/core";
import {
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  ArrowForward as ArrowForwardIcon
} from "@material-ui/icons";
import { format } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";
import api from "../../services/api";
import { toast } from "react-toastify";

import ActivityExecution from "./ActivityExecution";

const useStyles = makeStyles((theme) => ({
  root: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  header: {
    marginBottom: theme.spacing(3),
  },
  card: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    transition: "0.3s",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: theme.shadows[4],
    },
  },
  statusChip: {
    fontWeight: "bold",
  },
}));

const MyActivities = () => {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [executionOpen, setExecutionOpen] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/my-activities");
      setActivities(data.activities || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar atividades");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExecution = (activity) => {
    setSelectedActivity(activity);
    setExecutionOpen(true);
  };

  const handleCloseExecution = () => {
    setExecutionOpen(false);
    setSelectedActivity(null);
    fetchActivities(); // Refresh list
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "default";
      case "in_progress": return "primary";
      case "done": return "secondary"; // or success
      default: return "default";
    }
  };

  const getStatusLabel = (status) => {
      const map = {
          pending: "Pendente",
          in_progress: "Em Progresso",
          done: "Concluído",
          cancelled: "Cancelado"
      };
      return map[status] || status;
  }

  return (
    <Container className={classes.root} maxWidth="lg">
      <div className={classes.header}>
        <Typography variant="h4" component="h1" gutterBottom>
          Minhas Atividades
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          Gerencie suas tarefas de campo
        </Typography>
      </div>

      {loading ? (
        <Grid container justify="center">
          <CircularProgress />
        </Grid>
      ) : activities.length === 0 ? (
        <Typography variant="h6" align="center" color="textSecondary">
          Nenhuma atividade atribuída no momento.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {activities.map((activity) => (
            <Grid item xs={12} sm={6} md={4} key={activity.id}>
              <Card className={classes.card}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Chip
                      label={getStatusLabel(activity.status)}
                      color={getStatusColor(activity.status)}
                      size="small"
                      className={classes.statusChip}
                    />
                    <Typography variant="caption" color="textSecondary">
                      #{activity.id}
                    </Typography>
                  </Box>
                  
                  <Typography variant="h6" gutterBottom>
                    {activity.title}
                  </Typography>
                  
                  <Typography variant="body2" color="textSecondary" paragraph>
                    {activity.description || "Sem descrição"}
                  </Typography>

                  <Box display="flex" alignItems="center" mt={2}>
                    <ScheduleIcon fontSize="small" color="action" style={{ marginRight: 4 }} />
                    <Typography variant="caption" color="textSecondary">
                      {format(new Date(activity.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </Typography>
                  </Box>
                </CardContent>
                
                <CardActions>
                  <Button
                    size="medium"
                    color="primary"
                    variant="contained"
                    fullWidth
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => handleOpenExecution(activity)}
                  >
                    Executar
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {selectedActivity && (
        <ActivityExecution
          open={executionOpen}
          activityId={selectedActivity.id}
          onClose={handleCloseExecution}
        />
      )}
    </Container>
  );
};

export default MyActivities;
