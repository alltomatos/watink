import React, { useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import Checkbox from '@material-ui/core/Checkbox';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import SearchIcon from '@material-ui/icons/Search';
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    margin: 'auto',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paper: {
    width: 350,
    height: 500,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
  },
  cardHeader: {
    padding: theme.spacing(2),
    background: theme.palette.action.hover,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  list: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: theme.palette.background.paper,
  },
  button: {
    margin: theme.spacing(0.5, 0),
    minWidth: 100,
  },
  actionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: theme.spacing(2),
  },
  searchContainer: {
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
}));

function not(a, b) {
  return a.filter((value) => b.indexOf(value) === -1);
}

function intersection(a, b) {
  return a.filter((value) => b.indexOf(value) !== -1);
}

function union(a, b) {
  return [...a, ...not(b, a)];
}

export default function RolePermissionTransferList({ allPermissions = [], selectedPermissions = [], onChange }) {
  const classes = useStyles();
  const [checked, setChecked] = useState([]);
  const [left, setLeft] = useState([]);
  const [right, setRight] = useState([]);
  const [searchLeft, setSearchLeft] = useState("");
  const [searchRight, setSearchRight] = useState("");

  useEffect(() => {
    // Initialize left (unassigned) and right (assigned) lists
    const assignedIds = new Set(selectedPermissions);
    const leftSide = allPermissions.filter(p => !assignedIds.has(p.id));
    const rightSide = allPermissions.filter(p => assignedIds.has(p.id));
    
    setLeft(leftSide);
    setRight(rightSide);
  }, [allPermissions, selectedPermissions]);

  const leftChecked = intersection(checked, left);
  const rightChecked = intersection(checked, right);

  const handleToggle = (value) => () => {
    const currentIndex = checked.indexOf(value);
    const newChecked = [...checked];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  const numberOfChecked = (items) => intersection(checked, items).length;

  const handleToggleAll = (items) => () => {
    if (numberOfChecked(items) === items.length) {
      setChecked(not(checked, items));
    } else {
      setChecked(union(checked, items));
    }
  };

  const handleCheckedRight = () => {
    const newRight = right.concat(leftChecked);
    const newLeft = not(left, leftChecked);
    
    setRight(newRight);
    setLeft(newLeft);
    setChecked(not(checked, leftChecked));
    
    // Notify parent
    onChange(newRight.map(p => p.id));
  };

  const handleCheckedLeft = () => {
    const newLeft = left.concat(rightChecked);
    const newRight = not(right, rightChecked);
    
    setLeft(newLeft);
    setRight(newRight);
    setChecked(not(checked, rightChecked));
    
    // Notify parent
    onChange(newRight.map(p => p.id));
  };

  const getFilteredList = (list, search) => {
    if (!search) return list;
    return list.filter(item => {
        const searchText = search.toLowerCase();
        return (item.name && item.name.toLowerCase().includes(searchText)) || 
               (item.description && item.description.toLowerCase().includes(searchText));
    });
  };

  const filteredLeft = getFilteredList(left, searchLeft);
  const filteredRight = getFilteredList(right, searchRight);

  const customList = (title, items, search, setSearch) => (
    <Card className={classes.paper} elevation={0}>
      <CardHeader
        className={classes.cardHeader}
        avatar={
          <Checkbox
            onClick={handleToggleAll(items)}
            checked={numberOfChecked(items) === items.length && items.length !== 0}
            indeterminate={numberOfChecked(items) !== items.length && numberOfChecked(items) !== 0}
            disabled={items.length === 0}
            inputProps={{ 'aria-label': 'all items selected' }}
            color="primary"
          />
        }
        title={title}
        subheader={`${numberOfChecked(items)}/${items.length} selected`}
      />
      <div className={classes.searchContainer}>
        <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder={i18n.t("quickAnswers.searchPlaceholder")} // "Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <SearchIcon color="action" fontSize="small" />
                    </InputAdornment>
                ),
            }}
        />
      </div>
      <Divider />
      <List className={classes.list} dense component="div" role="list">
        {items.map((value) => {
          const labelId = `transfer-list-all-item-${value.id}-label`;
          const displayText = value.description || value.name;
          const secondaryText = value.description ? value.name : null;

          return (
            <ListItem key={value.id} role="listitem" button onClick={handleToggle(value)}>
              <ListItemIcon>
                <Checkbox
                  checked={checked.indexOf(value) !== -1}
                  tabIndex={-1}
                  disableRipple
                  inputProps={{ 'aria-labelledby': labelId }}
                  color="primary"
                />
              </ListItemIcon>
              <ListItemText 
                id={labelId} 
                primary={displayText} 
                secondary={secondaryText} 
              />
            </ListItem>
          );
        })}
        <ListItem />
      </List>
    </Card>
  );

  return (
    <Grid container spacing={2} className={classes.root}>
      <Grid item>{customList(i18n.t("role.permissions.available") || "Disponíveis", filteredLeft, searchLeft, setSearchLeft)}</Grid>
      <Grid item>
        <div className={classes.actionsContainer}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            className={classes.button}
            onClick={handleCheckedRight}
            disabled={leftChecked.length === 0}
            aria-label="move selected right"
          >
            &gt;
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="small"
            className={classes.button}
            onClick={handleCheckedLeft}
            disabled={rightChecked.length === 0}
            aria-label="move selected left"
          >
            &lt;
          </Button>
        </div>
      </Grid>
      <Grid item>{customList(i18n.t("role.permissions.assigned") || "Atribuídas", filteredRight, searchRight, setSearchRight)}</Grid>
    </Grid>
  );
}
