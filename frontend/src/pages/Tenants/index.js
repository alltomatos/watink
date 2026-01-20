import React, { useState, useEffect, useReducer } from "react";
import { toast } from "react-toastify";

import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  makeStyles,
  Button,
} from "@material-ui/core";
import { DeleteOutline, Edit } from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import TenantModal from "../../components/TenantModal";
import ConfirmationModal from "../../components/ConfirmationModal";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_TENANTS") {
    const tenants = action.payload;
    const newTenants = [];

    tenants.forEach((tenant) => {
      const tenantIndex = state.findIndex((t) => t.id === tenant.id);
      if (tenantIndex !== -1) {
        state[tenantIndex] = tenant;
      } else {
        newTenants.push(tenant);
      }
    });

    return [...state, ...newTenants];
  }

  if (action.type === "UPDATE_TENANTS") {
    const tenant = action.payload;
    const tenantIndex = state.findIndex((t) => t.id === tenant.id);

    if (tenantIndex !== -1) {
      state[tenantIndex] = tenant;
      return [...state];
    } else {
      return [tenant, ...state];
    }
  }

  if (action.type === "DELETE_TENANT") {
    const tenantId = action.payload;

    const tenantIndex = state.findIndex((t) => t.id === tenantId);
    if (tenantIndex !== -1) {
      state.splice(tenantIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const Tenants = () => {
  const classes = useStyles();
  const [tenants, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletingTenant, setDeletingTenant] = useState(null);

  useEffect(() => {
    setLoading(true);
    const fetchTenants = async () => {
      try {
        const { data } = await api.get("/tenants");
        dispatch({ type: "LOAD_TENANTS", payload: data });
        setLoading(false);
      } catch (err) {
        toastError(err);
        setLoading(false);
      }
    };
    fetchTenants();
  }, []);

  const handleOpenTenantModal = () => {
    setSelectedTenantId(null);
    setTenantModalOpen(true);
  };

  const handleCloseTenantModal = () => {
    setSelectedTenantId(null);
    setTenantModalOpen(false);
  };

  const handleEditTenant = (tenantId) => {
    setSelectedTenantId(tenantId);
    setTenantModalOpen(true);
  };

  const handleDeleteTenant = async (tenantId) => {
    try {
      await api.delete(`/tenants/${tenantId}`);
      dispatch({ type: "DELETE_TENANT", payload: tenantId });
      toast.success("Tenant deleted successfully!");
    } catch (err) {
      toastError(err);
    }
    setDeletingTenant(null);
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={deletingTenant && `Delete ${deletingTenant.name}?`}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteTenant(deletingTenant.id)}
      >
        Are you sure you want to delete this tenant? All related data will be lost.
      </ConfirmationModal>
      <TenantModal
        open={tenantModalOpen}
        onClose={handleCloseTenantModal}
        tenantId={selectedTenantId}
      />
      <MainHeader>
        <Title>Tenants</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenTenantModal}
          >
            Add Tenant
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>{tenant.id}</TableCell>
                <TableCell>{tenant.name}</TableCell>
                <TableCell>{tenant.status}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => handleEditTenant(tenant.id)}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setDeletingTenant(tenant);
                      setConfirmModalOpen(true);
                    }}
                  >
                    <DeleteOutline />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Tenants;
