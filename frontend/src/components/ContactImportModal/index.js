import React, { useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    CircularProgress,
    LinearProgress,
    Paper,
    Divider,
    Chip,
    IconButton,
    Collapse,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Fade,
} from "@material-ui/core";
import {
    CloudUploadOutlined,
    InsertDriveFileOutlined,
    CheckCircleOutlined,
    ErrorOutline,
    WarningOutlined,
    GetAppOutlined,
    ExpandMore,
    ExpandLess,
    Close,
} from "@material-ui/icons";
import { green, blue, amber, grey, red } from "@material-ui/core/colors";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
    dialog: {
        "& .MuiDialog-paper": {
            borderRadius: 16,
            minWidth: 500,
            overflow: "hidden",
        },
    },
    dialogTitle: {
        background: `linear-gradient(135deg, ${green[500]} 0%, ${blue[600]} 100%)`,
        color: "#fff",
        padding: theme.spacing(2, 3),
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    dialogContent: {
        padding: theme.spacing(3),
        backgroundColor: "#fafafa",
    },
    dropZone: {
        border: `2px dashed ${grey[300]}`,
        borderRadius: 16,
        padding: theme.spacing(4),
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.3s ease",
        backgroundColor: "#fff",
        "&:hover": {
            borderColor: blue[400],
            backgroundColor: blue[50],
        },
    },
    dropZoneActive: {
        borderColor: blue[500],
        backgroundColor: blue[50],
        transform: "scale(1.02)",
    },
    dropZoneDisabled: {
        cursor: "not-allowed",
        opacity: 0.6,
    },
    uploadIcon: {
        fontSize: 64,
        color: grey[400],
        marginBottom: theme.spacing(2),
    },
    uploadIconActive: {
        color: blue[500],
    },
    fileInfo: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: theme.spacing(1.5, 2),
        backgroundColor: blue[50],
        borderRadius: 10,
        marginTop: theme.spacing(2),
    },
    fileName: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
    },
    downloadLink: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing(0.5),
        marginTop: theme.spacing(2),
        color: blue[600],
        cursor: "pointer",
        fontSize: "0.875rem",
        transition: "all 0.2s ease",
        "&:hover": {
            color: blue[800],
            textDecoration: "underline",
        },
    },
    resultCard: {
        padding: theme.spacing(2),
        borderRadius: 12,
        marginTop: theme.spacing(2),
    },
    successCard: {
        backgroundColor: green[50],
        border: `1px solid ${green[200]}`,
    },
    warningCard: {
        backgroundColor: amber[50],
        border: `1px solid ${amber[200]}`,
    },
    errorCard: {
        backgroundColor: red[50],
        border: `1px solid ${red[200]}`,
    },
    resultStats: {
        display: "flex",
        justifyContent: "space-around",
        marginTop: theme.spacing(2),
        gap: theme.spacing(2),
    },
    statItem: {
        textAlign: "center",
    },
    statNumber: {
        fontSize: "1.5rem",
        fontWeight: 700,
    },
    statLabel: {
        fontSize: "0.75rem",
        color: grey[600],
        textTransform: "uppercase",
    },
    errorList: {
        maxHeight: 200,
        overflowY: "auto",
        marginTop: theme.spacing(1),
        ...theme.scrollbarStyles,
    },
    errorHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        padding: theme.spacing(1),
        borderRadius: 8,
        "&:hover": {
            backgroundColor: "rgba(0,0,0,0.04)",
        },
    },
    dialogActions: {
        padding: theme.spacing(2, 3),
        backgroundColor: "#fff",
        borderTop: `1px solid ${grey[200]}`,
    },
    cancelButton: {
        borderRadius: 10,
        textTransform: "none",
    },
    submitButton: {
        borderRadius: 10,
        textTransform: "none",
        fontWeight: 600,
        background: `linear-gradient(135deg, ${green[500]} 0%, ${green[700]} 100%)`,
        boxShadow: "0 4px 12px rgba(76, 175, 80, 0.3)",
        "&:hover": {
            background: `linear-gradient(135deg, ${green[600]} 0%, ${green[800]} 100%)`,
        },
        "&:disabled": {
            background: grey[300],
        },
    },
    progressContainer: {
        marginTop: theme.spacing(2),
    },
}));

const ContactImportModal = ({ open, onClose, onSuccess }) => {
    const classes = useStyles();
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [result, setResult] = useState(null);
    const [errorsExpanded, setErrorsExpanded] = useState(false);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.type === "text/csv" || droppedFile.name.endsWith(".csv"))) {
            setFile(droppedFile);
            setResult(null);
        } else {
            toast.warning(i18n.t("contactImport.errors.invalidFile") || "Por favor, selecione um arquivo CSV.");
        }
    }, []);

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult(null);
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        setResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleDownloadSample = async () => {
        try {
            const response = await api.get("/contacts/import-csv/sample", {
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "contacts_sample.csv");
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            toastError(err);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("delimiter", ";");

        try {
            const { data } = await api.post("/contacts/import-csv", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                },
            });

            setResult(data);

            if (data.errors === 0) {
                toast.success(i18n.t("contactImport.toasts.success") || `${data.success} contatos importados com sucesso!`);
            } else {
                toast.warning(i18n.t("contactImport.toasts.partial") || `Importação concluída com ${data.errors} erros.`);
            }

            if (onSuccess) onSuccess();
        } catch (err) {
            toastError(err);
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        if (!uploading) {
            setFile(null);
            setResult(null);
            setUploadProgress(0);
            onClose();
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            className={classes.dialog}
            maxWidth="sm"
            fullWidth
            TransitionComponent={Fade}
            transitionDuration={300}
        >
            <Box className={classes.dialogTitle}>
                <Typography variant="h6" style={{ fontWeight: 600 }}>
                    {i18n.t("contactImport.title") || "Importar Contatos"}
                </Typography>
                <IconButton size="small" onClick={handleClose} disabled={uploading}>
                    <Close style={{ color: "#fff" }} />
                </IconButton>
            </Box>

            <DialogContent className={classes.dialogContent}>
                {/* Drop Zone */}
                <Paper
                    elevation={0}
                    className={`${classes.dropZone} ${isDragging ? classes.dropZoneActive : ""} ${uploading ? classes.dropZoneDisabled : ""}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                >
                    <CloudUploadOutlined className={`${classes.uploadIcon} ${isDragging ? classes.uploadIconActive : ""}`} />
                    <Typography variant="h6" color="textSecondary">
                        {i18n.t("contactImport.dropZone.title") || "Arraste seu arquivo CSV aqui"}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        {i18n.t("contactImport.dropZone.subtitle") || "ou clique para selecionar"}
                    </Typography>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        hidden
                        onChange={handleFileSelect}
                        disabled={uploading}
                    />
                </Paper>

                {/* Selected File */}
                {file && (
                    <Box className={classes.fileInfo}>
                        <Box className={classes.fileName}>
                            <InsertDriveFileOutlined style={{ color: blue[500] }} />
                            <Box>
                                <Typography variant="body2" style={{ fontWeight: 500 }}>
                                    {file.name}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                    {formatFileSize(file.size)}
                                </Typography>
                            </Box>
                        </Box>
                        <IconButton size="small" onClick={handleRemoveFile} disabled={uploading}>
                            <Close />
                        </IconButton>
                    </Box>
                )}

                {/* Download Sample Link */}
                <Box className={classes.downloadLink} onClick={handleDownloadSample}>
                    <GetAppOutlined fontSize="small" />
                    <Typography variant="body2">
                        {i18n.t("contactImport.downloadSample") || "Baixar planilha modelo"}
                    </Typography>
                </Box>

                {/* Upload Progress */}
                {uploading && (
                    <Box className={classes.progressContainer}>
                        <LinearProgress variant="determinate" value={uploadProgress} />
                        <Typography variant="caption" color="textSecondary" align="center" display="block" style={{ marginTop: 8 }}>
                            {i18n.t("contactImport.uploading") || "Processando..."} {uploadProgress}%
                        </Typography>
                    </Box>
                )}

                {/* Results */}
                {result && (
                    <Paper
                        elevation={0}
                        className={`${classes.resultCard} ${result.errors === 0 ? classes.successCard : result.success > 0 ? classes.warningCard : classes.errorCard}`}
                    >
                        <Box display="flex" alignItems="center" gap={1}>
                            {result.errors === 0 ? (
                                <CheckCircleOutlined style={{ color: green[500] }} />
                            ) : result.success > 0 ? (
                                <WarningOutlined style={{ color: amber[700] }} />
                            ) : (
                                <ErrorOutline style={{ color: red[500] }} />
                            )}
                            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                                {result.errors === 0
                                    ? i18n.t("contactImport.results.success") || "Importação concluída!"
                                    : result.success > 0
                                        ? i18n.t("contactImport.results.partial") || "Importação parcial"
                                        : i18n.t("contactImport.results.failed") || "Falha na importação"}
                            </Typography>
                        </Box>

                        <Box className={classes.resultStats}>
                            <Box className={classes.statItem}>
                                <Typography className={classes.statNumber} style={{ color: grey[700] }}>
                                    {result.total}
                                </Typography>
                                <Typography className={classes.statLabel}>Total</Typography>
                            </Box>
                            <Box className={classes.statItem}>
                                <Typography className={classes.statNumber} style={{ color: green[600] }}>
                                    {result.created}
                                </Typography>
                                <Typography className={classes.statLabel}>Criados</Typography>
                            </Box>
                            <Box className={classes.statItem}>
                                <Typography className={classes.statNumber} style={{ color: blue[600] }}>
                                    {result.updated}
                                </Typography>
                                <Typography className={classes.statLabel}>Atualizados</Typography>
                            </Box>
                            <Box className={classes.statItem}>
                                <Typography className={classes.statNumber} style={{ color: red[500] }}>
                                    {result.errors}
                                </Typography>
                                <Typography className={classes.statLabel}>Erros</Typography>
                            </Box>
                        </Box>

                        {/* Error Details */}
                        {result.errorDetails && result.errorDetails.length > 0 && (
                            <Box mt={2}>
                                <Divider />
                                <Box
                                    className={classes.errorHeader}
                                    onClick={() => setErrorsExpanded(!errorsExpanded)}
                                >
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                        {i18n.t("contactImport.results.errorDetails") || "Detalhes dos erros"}
                                        <Chip size="small" label={result.errorDetails.length} style={{ marginLeft: 8 }} />
                                    </Typography>
                                    {errorsExpanded ? <ExpandLess /> : <ExpandMore />}
                                </Box>
                                <Collapse in={errorsExpanded}>
                                    <List dense className={classes.errorList}>
                                        {result.errorDetails.map((err, idx) => (
                                            <ListItem key={idx}>
                                                <ListItemIcon style={{ minWidth: 36 }}>
                                                    <ErrorOutline fontSize="small" style={{ color: red[400] }} />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={`Linha ${err.row}`}
                                                    secondary={err.error}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Collapse>
                            </Box>
                        )}
                    </Paper>
                )}
            </DialogContent>

            <DialogActions className={classes.dialogActions}>
                <Button
                    onClick={handleClose}
                    variant="outlined"
                    className={classes.cancelButton}
                    disabled={uploading}
                >
                    {i18n.t("contactImport.buttons.cancel") || "Fechar"}
                </Button>
                <Button
                    onClick={handleUpload}
                    variant="contained"
                    color="primary"
                    className={classes.submitButton}
                    disabled={!file || uploading || result}
                    startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                    {uploading
                        ? i18n.t("contactImport.buttons.uploading") || "Importando..."
                        : i18n.t("contactImport.buttons.import") || "Importar Contatos"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ContactImportModal;
