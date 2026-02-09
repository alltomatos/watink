import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Typography,
  Box,
  makeStyles
} from "@material-ui/core";
import SignatureCanvas from "react-signature-canvas";

const useStyles = makeStyles((theme) => ({
  signatureContainer: {
    border: "1px solid #ccc",
    borderRadius: 4,
    backgroundColor: "#f9f9f9",
    width: "100%",
    height: 300,
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  canvas: {
    width: "100%",
    height: "100%"
  }
}));

const SignatureModal = ({ open, onClose, onConfirm, title = "Assinatura" }) => {
  const classes = useStyles();
  const sigPad = useRef({});
  const [empty, setEmpty] = useState(true);

  const clear = () => {
    sigPad.current.clear();
    setEmpty(true);
  };

  const save = () => {
    if (sigPad.current.isEmpty()) {
      alert("Por favor, assine antes de confirmar.");
      return;
    }
    const dataUrl = sigPad.current.getTrimmedCanvas().toDataURL("image/png");
    onConfirm(dataUrl);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Por favor, assine no campo abaixo para confirmar a execução.
        </Typography>
        <Box className={classes.signatureContainer}>
          <SignatureCanvas
            ref={sigPad}
            penColor="black"
            canvasProps={{ className: classes.canvas }}
            onBegin={() => setEmpty(false)}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={clear} color="secondary">
          Limpar
        </Button>
        <Button onClick={onClose} color="default">
          Cancelar
        </Button>
        <Button onClick={save} color="primary" variant="contained" disabled={empty}>
          Confirmar Assinatura
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SignatureModal;
