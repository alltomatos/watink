import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
    Dialog,
    DialogContent,
} from "@material-ui/core";
import {
    GetApp as DownloadIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    InsertDriveFile as FileIcon,
    PictureAsPdf as PdfIcon,
    Description as DocIcon,
    Image as ImageIcon,
} from "@material-ui/icons";
import { getBackendUrl } from "../../helpers/urlUtils";

const useStyles = makeStyles((theme) => ({
    container: {
        display: "flex",
        flexWrap: "wrap",
        gap: theme.spacing(1.5),
        padding: theme.spacing(1),
    },
    attachmentCard: {
        width: 110,
        height: 120,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #e0e0e0",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#fafafa",
        cursor: "pointer",
        transition: "all 0.2s ease",
        "&:hover": {
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            transform: "translateY(-2px)",
        },
    },
    imagePreview: {
        width: "100%",
        height: 80,
        objectFit: "cover",
    },
    iconContainer: {
        width: "100%",
        height: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f0f0f0",
    },
    fileIcon: {
        fontSize: 36,
    },
    pdfIcon: { color: "#e53935" },
    docIcon: { color: "#1565c0" },
    xlsIcon: { color: "#2e7d32" },
    imgIcon: { color: "#7b1fa2" },
    defaultIcon: { color: "#757575" },
    infoBox: {
        padding: theme.spacing(0.5, 1),
        backgroundColor: "#fff",
        borderTop: "1px solid #e0e0e0",
        flexGrow: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    fileName: {
        fontSize: 10,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 60,
    },
    actionButtons: {
        display: "flex",
    },
    smallButton: {
        padding: 2,
    },
    lightboxDialog: {
        "& .MuiDialog-paper": {
            backgroundColor: "transparent",
            boxShadow: "none",
        },
    },
    lightboxImage: {
        maxWidth: "90vw",
        maxHeight: "85vh",
        borderRadius: 8,
    },
    closeButton: {
        position: "absolute",
        top: 16,
        right: 16,
        backgroundColor: "rgba(0,0,0,0.5)",
        color: "#fff",
        "&:hover": {
            backgroundColor: "rgba(0,0,0,0.7)",
        },
    },
    emptyState: {
        textAlign: "center",
        padding: theme.spacing(3),
        color: theme.palette.text.secondary,
    },
}));

const getFileIcon = (fileType, classes) => {
    if (fileType?.startsWith("image/")) {
        return <ImageIcon className={`${classes.fileIcon} ${classes.imgIcon}`} />;
    }
    if (fileType === "application/pdf") {
        return <PdfIcon className={`${classes.fileIcon} ${classes.pdfIcon}`} />;
    }
    if (fileType?.includes("word") || fileType?.includes("document")) {
        return <DocIcon className={`${classes.fileIcon} ${classes.docIcon}`} />;
    }
    if (fileType?.includes("excel") || fileType?.includes("spreadsheet")) {
        return <FileIcon className={`${classes.fileIcon} ${classes.xlsIcon}`} />;
    }
    return <FileIcon className={`${classes.fileIcon} ${classes.defaultIcon}`} />;
};

const AttachmentsList = ({
    attachments = [],
    onDelete,
    canDelete = false,
    showEmpty = true,
}) => {
    const classes = useStyles();
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const getUrl = (attachment) => {
        return getBackendUrl(attachment.filePath);
    };

    const handleDownload = (attachment, e) => {
        e.stopPropagation();
        const url = getUrl(attachment);
        const link = document.createElement("a");
        link.href = url;
        link.download = attachment.originalName;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = (attachment, e) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(attachment.id);
        }
    };

    const handleClick = (attachment) => {
        if (attachment.fileType?.startsWith("image/")) {
            setSelectedImage(getUrl(attachment));
            setLightboxOpen(true);
        } else {
            handleDownload(attachment, { stopPropagation: () => { } });
        }
    };

    if (!attachments || attachments.length === 0) {
        if (!showEmpty) return null;
        return (
            <Box className={classes.emptyState}>
                <Typography variant="body2">Nenhum anexo</Typography>
            </Box>
        );
    }

    return (
        <>
            <Box className={classes.container}>
                {attachments.map((attachment) => (
                    <Box
                        key={attachment.id}
                        className={classes.attachmentCard}
                        onClick={() => handleClick(attachment)}
                    >
                        {attachment.fileType?.startsWith("image/") ? (
                            <img
                                src={getUrl(attachment)}
                                alt={attachment.originalName}
                                className={classes.imagePreview}
                            />
                        ) : (
                            <Box className={classes.iconContainer}>
                                {getFileIcon(attachment.fileType, classes)}
                            </Box>
                        )}
                        <Box className={classes.infoBox}>
                            <Tooltip title={attachment.originalName}>
                                <Typography className={classes.fileName}>
                                    {attachment.originalName}
                                </Typography>
                            </Tooltip>
                            <Box className={classes.actionButtons}>
                                <Tooltip title="Baixar">
                                    <IconButton
                                        size="small"
                                        className={classes.smallButton}
                                        onClick={(e) => handleDownload(attachment, e)}
                                    >
                                        <DownloadIcon style={{ fontSize: 14 }} />
                                    </IconButton>
                                </Tooltip>
                                {canDelete && (
                                    <Tooltip title="Excluir">
                                        <IconButton
                                            size="small"
                                            className={classes.smallButton}
                                            onClick={(e) => handleDelete(attachment, e)}
                                        >
                                            <DeleteIcon style={{ fontSize: 14, color: "#e53935" }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        </Box>
                    </Box>
                ))}
            </Box>

            {/* Image Lightbox */}
            <Dialog
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                maxWidth="xl"
                className={classes.lightboxDialog}
            >
                <IconButton
                    className={classes.closeButton}
                    onClick={() => setLightboxOpen(false)}
                >
                    <CloseIcon />
                </IconButton>
                <DialogContent style={{ padding: 0 }}>
                    {selectedImage && (
                        <img
                            src={selectedImage}
                            alt="Preview"
                            className={classes.lightboxImage}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AttachmentsList;
