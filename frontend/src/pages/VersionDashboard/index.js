import React, { useEffect, useState, useCallback } from "react";
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  CircularProgress,
  IconButton,
  useTheme
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Extension as ExtensionIcon // Kept only for section header if needed, or can remove
} from "@material-ui/icons";

import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  headerContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(2),
  },
  title: {
    fontWeight: 600,
    color: theme.palette.text.primary,
    fontSize: '1.5rem',
  },
  paper: {
    borderRadius: 8,
    boxShadow: "0 2px 10px 0 rgba(0,0,0,0.05)",
    overflow: "hidden",
  },
  tableHeader: {
    backgroundColor: theme.palette.grey[50],
  },
  tableHeaderCell: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    fontSize: "0.7rem",
    letterSpacing: "0.05em",
    padding: theme.spacing(1.5, 2), // Condensed padding
  },
  tableRow: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    transition: "background-color 0.2s",
  },
  tableCell: {
    padding: theme.spacing(1, 2), // Condensed padding for rows
    fontSize: "0.875rem",
  },
  serviceName: {
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  serviceKey: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
  },
  versionChip: {
    fontWeight: 500,
    backgroundColor: theme.palette.action.selected,
    height: 24, // Smaller chip
    fontSize: "0.75rem",
  },
  statusChip: {
    fontWeight: 600,
    minWidth: 70,
    height: 24, // Smaller chip
    fontSize: "0.75rem",
  },
  statusOnline: {
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    color: "#4caf50",
    border: "1px solid rgba(76, 175, 80, 0.2)",
  },
  statusOffline: {
    backgroundColor: "rgba(244, 67, 54, 0.1)",
    color: "#f44336",
    border: "1px solid rgba(244, 67, 54, 0.2)",
  },
  latencyTag: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: "0.75rem",
    fontWeight: 500,
  },
  latencyGood: {
    color: "#4caf50",
    backgroundColor: "rgba(76, 175, 80, 0.05)",
  },
  latencyMedium: {
    color: "#ff9800",
    backgroundColor: "rgba(255, 152, 0, 0.05)",
  },
  latencyBad: {
    color: "#f44336",
    backgroundColor: "rgba(244, 67, 54, 0.05)",
  },
  sectionHeader: {
    padding: theme.spacing(1.5, 2),
    backgroundColor: theme.palette.grey[50],
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  sectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: theme.palette.text.secondary,
  },
}));

const endpoints = [
  { key: "frontend", url: "/version.json", displayName: "Frontend" },
  { key: "backend", url: "/version", displayName: "Backend API" },
  { key: "plugin-manager", url: "/plugins/version", displayName: "Marketplace" },
  { key: "whaileys-engine", url: "/engine/version", displayName: "Whaileys Engine" },
  { key: "postgres", url: "/postgres/version", displayName: "Database (Postgres)" },
  { key: "rabbitmq", url: "/rabbitmq/version", displayName: "Queue (RabbitMQ)" },
  { key: "redis", url: "/redis/version", displayName: "Cache (Redis)" },
];

const extractPostgresVersion = (version) => {
  if (!version || version === "-") return "-";
  const match = version.match(/PostgreSQL\s+([\d.]+)/i);
  return match ? match[1] : version;
};

export default function VersionDashboard() {
  const classes = useStyles();
  const theme = useTheme();
  const [data, setData] = useState({});
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    const results = {};
    const fetchOne = async (endpoint) => {
      const { key, url, displayName } = endpoint;
      const start = performance.now();
      try {
        const urlWithCacheBuster = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;

        let res;
        // For frontend static file, use fetch (public)
        if (key === 'frontend') {
          const response = await fetch(urlWithCacheBuster);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          res = await response.json();
        } else {
          // For all other services (proxied via backend or direct backend), use authenticated api instance
          const response = await api.get(urlWithCacheBuster);
          res = response.data;
        }

        const elapsed = performance.now() - start;
        let version = res.version || "-";

        if (key === "postgres") {
          version = extractPostgresVersion(version);
        }

        results[key] = {
          service: displayName,
          version,
          latencyMs: Math.round(elapsed),
          isOnline: true,
        };
      } catch (e) {
        // If 401/403, and it's plugin-manager, it implies it's reachable but we might have auth issue?
        // But generally any error assumes offline/unreachable for dashboard purposes
        const elapsed = performance.now() - start;
        results[key] = {
          service: displayName,
          version: "-",
          latencyMs: Math.round(elapsed),
          isOnline: false,
        };
      }
    };

    await Promise.all(endpoints.map((e) => fetchOne(e)));

    // Check plugin manager status in results
    const pmStatus = results["plugin-manager"]?.isOnline;

    setData(results);

    // Fetch plugins if marketplace is online
    if (pmStatus) {
      try {
        const [{ data: catalog }, { data: installed }] = await Promise.all([
          api.get("/plugins/api/v1/plugins/catalog"),
          api.get("/plugins/api/v1/plugins/installed")
        ]);

        const allPlugins = catalog.plugins || [];
        const activePlugins = installed.active || [];

        const pluginsList = allPlugins.map(p => ({
          name: p.slug === 'webchat' ? 'Webchat engine' : p.name,
          version: p.version,
          active: activePlugins.includes(p.slug),
          slug: p.slug
        }));

        setPlugins(pluginsList);

      } catch (e) {
        console.error("Failed to fetch plugins", e);
        setPlugins([]);
      }
    } else {
      setPlugins([]);
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVersions();
    const id = setInterval(fetchVersions, 5 * 60 * 1000); // 5 min
    return () => clearInterval(id);
  }, [fetchVersions]);

  const getLatencyStyle = (ms) => {
    if (ms < 100) return classes.latencyGood;
    if (ms < 500) return classes.latencyMedium;
    return classes.latencyBad;
  };

  const rows = endpoints.map((e) => ({
    ...e,
    ...(data[e.key] || { version: "-", latencyMs: 0, isOnline: false })
  }));

  return (
    <Container maxWidth="md" className={classes.root}>
      <Paper className={classes.paper} style={{ marginBottom: 16, padding: 16, backgroundColor: '#f8f9fa' }}>
        <Typography variant="body2" color="textSecondary" align="center" style={{ fontSize: '0.9rem' }}>
          Hospedagem Indicada: <a href="https://painelcliente.com.br/aff.php?aff=87&gid=32" target="_blank" rel="noopener noreferrer" style={{ color: theme.palette.primary.main, textDecoration: 'none', fontWeight: 600 }}>HOSTEG</a>
          <span style={{ margin: '0 12px', color: '#e0e0e0' }}>|</span>
          Github: <a href="https://github.com/alltomatos/watink" target="_blank" rel="noopener noreferrer" style={{ color: theme.palette.primary.main, textDecoration: 'none', fontWeight: 600 }}>WATINK</a>
        </Typography>
      </Paper>

      <Box className={classes.headerContainer}>
        <div>
          <Typography variant="h4" className={classes.title}>
            Monitoramento de Serviços
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Última atualização: {lastUpdated.toLocaleTimeString()}
          </Typography>
        </div>
        <IconButton
          onClick={fetchVersions}
          disabled={loading}
          color="primary"
          size="small"
        >
          {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
        </IconButton>
      </Box>

      <TableContainer component={Paper} className={classes.paper} elevation={0}>
        <Table className={classes.table} size="small">
          <TableHead className={classes.tableHeader}>
            <TableRow>
              <TableCell className={classes.tableHeaderCell}>Serviços</TableCell>
              <TableCell className={classes.tableHeaderCell} align="center">Versão</TableCell>
              <TableCell className={classes.tableHeaderCell} align="center">Latência</TableCell>
              <TableCell className={classes.tableHeaderCell} align="right">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key} className={classes.tableRow}>
                <TableCell className={classes.tableCell}>
                  <span className={classes.serviceName}>{row.displayName}</span>
                  <span className={classes.serviceKey}>({row.key})</span>
                </TableCell>
                <TableCell align="center" className={classes.tableCell}>
                  <Chip
                    label={row.version}
                    size="small"
                    variant="outlined"
                    className={classes.versionChip}
                  />
                </TableCell>
                <TableCell align="center" className={classes.tableCell}>
                  {row.isOnline ? (
                    <span className={`${classes.latencyTag} ${getLatencyStyle(row.latencyMs)}`}>
                      {row.latencyMs} ms
                    </span>
                  ) : (
                    <span className={classes.latencyTag} style={{ color: "#bdbdbd" }}>-</span>
                  )}
                </TableCell>
                <TableCell align="right" className={classes.tableCell}>
                  <Chip
                    icon={row.isOnline ? <CheckCircleIcon style={{ fontSize: 14 }} /> : <ErrorIcon style={{ fontSize: 14 }} />}
                    label={row.isOnline ? "Online" : "Offline"}
                    size="small"
                    className={`${classes.statusChip} ${row.isOnline ? classes.statusOnline : classes.statusOffline}`}
                  />
                </TableCell>
              </TableRow>
            ))}

            {/* Plugins Section */}
            {plugins.length > 0 && (
              <>
                <TableRow>
                  <TableCell colSpan={4} className={classes.sectionHeader}>
                    <div className={classes.sectionTitle}>
                      Plugins Disponíveis no Marketplace
                    </div>
                  </TableCell>
                </TableRow>
                {plugins.map((plugin, index) => (
                  <TableRow key={plugin.slug || index} className={classes.tableRow}>
                    <TableCell className={classes.tableCell}>
                      <span className={classes.serviceName}>{plugin.name}</span>
                      <span className={classes.serviceKey}>({plugin.slug})</span>
                    </TableCell>
                    <TableCell align="center" className={classes.tableCell}>
                      <Chip
                        label={`v${plugin.version}`}
                        size="small"
                        variant="outlined"
                        className={classes.versionChip}
                      />
                    </TableCell>
                    <TableCell align="center" className={classes.tableCell}>
                      <span className={classes.latencyTag} style={{ color: "#bdbdbd" }}>-</span>
                    </TableCell>
                    <TableCell align="right" className={classes.tableCell}>
                      <Chip
                        label={plugin.active ? "Ativo" : "Inativo"}
                        size="small"
                        color={plugin.active ? "primary" : "default"}
                        variant={plugin.active ? "default" : "outlined"}
                        style={{ fontWeight: 600, minWidth: 70, height: 24 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}

            {/* Empty state for plugins if marketplace is offline */}
            {!data["plugin-manager"]?.isOnline && (
              <TableRow>
                <TableCell colSpan={4} align="center" style={{ padding: 16 }}>
                  <Typography variant="caption" color="textSecondary">
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                      <ErrorIcon color="disabled" fontSize="small" />
                      Marketplace Offline
                    </Box>
                  </Typography>
                </TableCell>
              </TableRow>
            )}

          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
