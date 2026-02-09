import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Slide,
  Tabs,
  Tab,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  TextField,
  Divider,
  Fab,
  CircularProgress,
  DialogContent,
  DialogActions,
  DialogTitle,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel
} from "@material-ui/core";
import {
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import api from "../../services/api";
import SignatureModal from "./SignatureModal";

const useStyles = makeStyles((theme) => ({
  appBar: {
    position: "relative",
  },
  title: {
    marginLeft: theme.spacing(2),
    flex: 1,
  },
  content: {
    padding: theme.spacing(2),
    backgroundColor: "#f5f5f5",
    minHeight: "100vh"
  },
  tabPanel: {
    padding: theme.spacing(2),
    backgroundColor: "#fff",
    borderRadius: 4,
    boxShadow: theme.shadows[1],
    marginBottom: theme.spacing(2)
  },
  mediaPreview: {
    width: 100,
    height: 100,
    objectFit: "cover",
    borderRadius: 4,
    marginTop: theme.spacing(1),
    border: "1px solid #ddd"
  },
  fab: {
    position: "fixed",
    bottom: theme.spacing(2),
    right: theme.spacing(2),
  }
}));

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box p={2}>{children}</Box>}
    </div>
  );
};

const ActivityExecution = ({ open, activityId, onClose }) => {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState(null);
  const [items, setItems] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  
  // Materials Modal
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ 
    name: "", 
    quantity: 1, 
    unit: "un", 
    isBillable: false,
    notes: "" 
  });

  // Occurrence Modal
  const [occurrenceModalOpen, setOccurrenceModalOpen] = useState(false);
  const [newOccurrence, setNewOccurrence] = useState({
      description: "",
      type: "info",
      timeImpact: ""
  });

  // Signature Modal
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);

  useEffect(() => {
    if (open && activityId) {
      loadActivity();
    }
  }, [open, activityId]);

  const loadActivity = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/activities/${activityId}`);
      setActivity(data);
      setItems(data.items || []);
      setMaterials(data.materials || []);
      setOccurrences(data.occurrences || []);
    } catch (err) {
      toast.error("Erro ao carregar detalhes da atividade");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  // --- Items Logic ---
  const handleItemChange = async (item, field, value) => {
    const newItems = items.map(i => i.id === item.id ? { ...i, [field]: value } : i);
    setItems(newItems);

    try {
        if (field === "isDone" || field === "value") {
           await api.put(`/activities/${activityId}/items/${item.id}`, { [field]: value });
        }
    } catch (err) {
        toast.error("Erro ao salvar item");
    }
  };

  const handleFileUpload = async (item, file) => {
      const formData = new FormData();
      formData.append("photo", file);
      
      try {
          const { data } = await api.post(`/activities/${activityId}/items/${item.id}/photo`, formData);
          await handleItemChange(item, "value", data.photoUrl);
      } catch(err) {
          toast.error("Erro ao enviar foto");
      }
  };

  // --- Materials Logic ---
  const handleAddMaterial = async () => {
      try {
          const { data } = await api.post(`/activities/${activityId}/materials`, {
              materialName: newMaterial.name,
              quantity: newMaterial.quantity,
              unit: newMaterial.unit,
              isBillable: newMaterial.isBillable,
              notes: newMaterial.notes
          });
          setMaterials([...materials, data]);
          setMaterialModalOpen(false);
          setNewMaterial({ name: "", quantity: 1, unit: "un", isBillable: false, notes: "" });
          toast.success("Material adicionado");
      } catch (err) {
          toast.error("Erro ao adicionar material");
      }
  };

  const handleDeleteMaterial = async (id) => {
      try {
          await api.delete(`/activities/${activityId}/materials/${id}`);
          setMaterials(materials.filter(m => m.id !== id));
      } catch(err) {
          toast.error("Erro ao remover material");
      }
  };

  // --- Occurrences Logic ---
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    if (!/^\d+:[0-5]\d$/.test(timeStr)) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
  };

  const minutesToTime = (minutes) => {
    if (minutes === null || minutes === undefined) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const handleAddOccurrence = async () => {
    try {
        const { data } = await api.post(`/activities/${activityId}/occurrences`, {
            description: newOccurrence.description,
            type: newOccurrence.type,
            timeImpact: timeToMinutes(newOccurrence.timeImpact)
        });
        setOccurrences([...occurrences, data]);
        setOccurrenceModalOpen(false);
        setNewOccurrence({ description: "", type: "info", timeImpact: "" });
        toast.success("Ocorrência registrada");
    } catch (err) {
        toast.error("Erro ao adicionar ocorrência");
    }
  };

  const handleDeleteOccurrence = async (id) => {
    try {
        await api.delete(`/activities/${activityId}/occurrences/${id}`);
        setOccurrences(occurrences.filter(o => o.id !== id));
    } catch (err) {
        toast.error("Erro ao remover ocorrência");
    }
  };

  // --- Finish Logic ---
  const handleFinish = async (signatureDataUrl) => {
      try {
          await api.post(`/activities/${activityId}/finalize`, {
              clientSignature: signatureDataUrl
          });
          toast.success("Atividade concluída com sucesso!");
          setSignatureModalOpen(false);
          onClose();
      } catch (err) {
          toast.error("Erro ao finalizar atividade");
      }
  };

  if (!activity) return null;

  return (
    <Dialog fullScreen open={open} onClose={onClose} TransitionComponent={Transition}>
      <AppBar className={classes.appBar}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" className={classes.title}>
            Execução: {activity.title}
          </Typography>
          <Button autoFocus color="inherit" onClick={() => setSignatureModalOpen(true)}>
            Finalizar
          </Button>
        </Toolbar>
      </AppBar>

      <div className={classes.content}>
        <Tabs 
            value={tab} 
            onChange={handleTabChange} 
            indicatorColor="primary" 
            textColor="primary" 
            variant="scrollable"
            scrollButtons="auto"
        >
          <Tab label="Checklist" />
          <Tab label="Materiais (RDO)" />
          <Tab label="Ocorrências" />
          <Tab label="Detalhes" />
        </Tabs>

        {loading ? (
            <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
        ) : (
            <>
                {/* Checklist Panel */}
                <TabPanel value={tab} index={0} className={classes.tabPanel}>
                    <List>
                        {items.map((item) => (
                            <Box key={item.id} mb={2} p={1} border="1px solid #eee" borderRadius={4}>
                                <Box display="flex" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" style={{ fontWeight: item.isRequired ? 'bold' : 'normal' }}>
                                        {item.label} {item.isRequired && "*"}
                                    </Typography>
                                    <Checkbox
                                        checked={item.isDone}
                                        onChange={(e) => handleItemChange(item, "isDone", e.target.checked)}
                                        color="primary"
                                    />
                                </Box>
                                
                                {item.inputType === "text" && (
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        value={item.value || ""}
                                        onChange={(e) => handleItemChange(item, "value", e.target.value)}
                                        placeholder="Digite a resposta..."
                                    />
                                )}

                                {item.inputType === "number" && (
                                    <TextField
                                        fullWidth
                                        type="number"
                                        variant="outlined"
                                        size="small"
                                        value={item.value || ""}
                                        onChange={(e) => handleItemChange(item, "value", e.target.value)}
                                        placeholder="0"
                                    />
                                )}

                                {item.inputType === "photo" && (
                                    <Box>
                                        <input
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id={`icon-button-file-${item.id}`}
                                            type="file"
                                            capture="environment"
                                            onChange={(e) => {
                                                if(e.target.files && e.target.files[0]) {
                                                    handleFileUpload(item, e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <label htmlFor={`icon-button-file-${item.id}`}>
                                            <Button variant="outlined" component="span" startIcon={<CameraIcon />}>
                                                Tirar Foto
                                            </Button>
                                        </label>
                                        {item.value && (
                                            <Box>
                                                <img src={item.value} alt="Preview" className={classes.mediaPreview} />
                                            </Box>
                                        )}
                                    </Box>
                                )}
                            </Box>
                        ))}
                    </List>
                </TabPanel>

                {/* Materials Panel (RDO) */}
                <TabPanel value={tab} index={1} className={classes.tabPanel}>
                    <List>
                        {materials.map((m) => (
                            <ListItem key={m.id} divider>
                                <ListItemText 
                                    primary={m.materialName} 
                                    secondary={
                                        <>
                                            <Typography component="span" variant="body2" color="textPrimary">
                                                {m.quantity} {m.unit}
                                            </Typography>
                                            {m.isBillable && <Typography component="span" variant="caption" style={{marginLeft: 8, color: 'green', fontWeight: 'bold'}}>$ Faturável</Typography>}
                                            {m.notes && <Typography component="p" variant="caption">{m.notes}</Typography>}
                                        </>
                                    } 
                                />
                                <ListItemSecondaryAction>
                                    <IconButton edge="end" onClick={() => handleDeleteMaterial(m.id)}>
                                        <DeleteIcon />
                                    </IconButton>
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                        {materials.length === 0 && (
                            <Typography align="center" color="textSecondary">Nenhum material utilizado.</Typography>
                        )}
                    </List>
                    <Box display="flex" justifyContent="flex-end" mt={2}>
                        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setMaterialModalOpen(true)}>
                            Adicionar Material
                        </Button>
                    </Box>
                </TabPanel>

                {/* Occurrences Panel */}
                <TabPanel value={tab} index={2} className={classes.tabPanel}>
                    <List>
                        {occurrences.map((o) => (
                            <ListItem key={o.id} divider>
                                <ListItemText 
                                    primary={o.description} 
                                    secondary={
                                        <>
                                            <Typography component="span" variant="caption" style={{
                                                backgroundColor: o.type === 'impediment' ? '#ffcdd2' : o.type === 'delay' ? '#fff9c4' : '#e1f5fe',
                                                padding: '2px 6px',
                                                borderRadius: 4,
                                                marginRight: 8
                                            }}>
                                                {o.type === 'impediment' ? 'Impedimento' : o.type === 'delay' ? 'Atraso' : 'Informativo'}
                                            </Typography>
                                            {o.timeImpact && <Typography component="span" variant="caption">Impacto: {minutesToTime(o.timeImpact)}</Typography>}
                                        </>
                                    } 
                                />
                                <ListItemSecondaryAction>
                                    <IconButton edge="end" onClick={() => handleDeleteOccurrence(o.id)}>
                                        <DeleteIcon />
                                    </IconButton>
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                        {occurrences.length === 0 && (
                            <Typography align="center" color="textSecondary">Nenhuma ocorrência registrada.</Typography>
                        )}
                    </List>
                    <Box display="flex" justifyContent="flex-end" mt={2}>
                        <Button variant="contained" color="secondary" startIcon={<WarningIcon />} onClick={() => setOccurrenceModalOpen(true)}>
                            Registrar Ocorrência
                        </Button>
                    </Box>
                </TabPanel>

                <TabPanel value={tab} index={3} className={classes.tabPanel}>
                    <Typography variant="h6">Detalhes da Atividade</Typography>
                    <Typography variant="body1" paragraph>{activity.description}</Typography>
                    <Divider />
                    <Box mt={2}>
                        <Typography variant="caption">Protocolo: #{activity.protocolId}</Typography>
                        <br />
                        <Typography variant="caption">Cliente: {activity.protocol?.client?.name || "N/A"}</Typography>
                    </Box>
                </TabPanel>
            </>
        )}
      </div>

      {/* Material Modal */}
      <Dialog open={materialModalOpen} onClose={() => setMaterialModalOpen(false)}>
          <DialogTitle>Adicionar Material</DialogTitle>
          <DialogContent>
              <TextField
                  autoFocus
                  margin="dense"
                  label="Nome do Material"
                  fullWidth
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
              />
              <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                        margin="dense"
                        label="Quantidade"
                        type="number"
                        fullWidth
                        value={newMaterial.quantity}
                        onChange={(e) => setNewMaterial({ ...newMaterial, quantity: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                        margin="dense"
                        label="Unidade"
                        fullWidth
                        value={newMaterial.unit}
                        onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                        placeholder="un, m, kg"
                    />
                  </Grid>
              </Grid>
              <TextField
                  margin="dense"
                  label="Observações"
                  fullWidth
                  value={newMaterial.notes}
                  onChange={(e) => setNewMaterial({ ...newMaterial, notes: e.target.value })}
              />
              <FormControlLabel
                  control={
                      <Switch
                          checked={newMaterial.isBillable}
                          onChange={(e) => setNewMaterial({ ...newMaterial, isBillable: e.target.checked })}
                          color="primary"
                      />
                  }
                  label="Item Faturável (Cobrar do cliente)"
              />
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setMaterialModalOpen(false)} color="primary">Cancelar</Button>
              <Button onClick={handleAddMaterial} color="primary">Adicionar</Button>
          </DialogActions>
      </Dialog>

      {/* Occurrence Modal */}
      <Dialog open={occurrenceModalOpen} onClose={() => setOccurrenceModalOpen(false)}>
          <DialogTitle>Registrar Ocorrência</DialogTitle>
          <DialogContent>
              <FormControl fullWidth margin="dense">
                  <InputLabel>Tipo</InputLabel>
                  <Select
                      value={newOccurrence.type}
                      onChange={(e) => setNewOccurrence({ ...newOccurrence, type: e.target.value })}
                  >
                      <MenuItem value="info">Informativo</MenuItem>
                      <MenuItem value="impediment">Impedimento (Parou o serviço)</MenuItem>
                      <MenuItem value="delay">Atraso (Reduziu ritmo)</MenuItem>
                  </Select>
              </FormControl>
              <TextField
                  autoFocus
                  margin="dense"
                  label="Descrição do Fato"
                  fullWidth
                  multiline
                  rows={3}
                  value={newOccurrence.description}
                  onChange={(e) => setNewOccurrence({ ...newOccurrence, description: e.target.value })}
              />
              <TextField
                  margin="dense"
                  label="Tempo de Impacto (ex: 01:30)"
                  fullWidth
                  value={newOccurrence.timeImpact}
                  onChange={(e) => setNewOccurrence({ ...newOccurrence, timeImpact: e.target.value })}
                  helperText="Opcional. Formato HH:MM (ex: 01:30 ou 26:00)"
                  error={newOccurrence.timeImpact !== "" && !/^\d+:[0-5]\d$/.test(newOccurrence.timeImpact)}
              />
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setOccurrenceModalOpen(false)} color="primary">Cancelar</Button>
              <Button onClick={handleAddOccurrence} color="primary">Registrar</Button>
          </DialogActions>
      </Dialog>

      {/* Signature Modal */}
      <SignatureModal
        open={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        onConfirm={handleFinish}
      />
    </Dialog>
  );
};

export default ActivityExecution;
