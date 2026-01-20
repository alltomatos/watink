import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Button, Typography, Paper, IconButton, Avatar } from '@material-ui/core';
import {
  GetApp,
  PictureAsPdf,
  Description,
  TableChart,
  InsertDriveFile,
  Image as ImageIcon,
  Audiotrack,
  Videocam
} from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1),
    maxWidth: '100%',
    width: '300px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  iconContainer: {
    marginRight: theme.spacing(1.5),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 8,
    color: '#fff',
    fontSize: 28,
  },
  thumbnail: {
    width: 48,
    height: 48,
    objectFit: 'cover',
    borderRadius: 8,
    marginRight: theme.spacing(1.5),
  },
  details: {
    flexGrow: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  filename: {
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: '14px',
    lineHeight: '1.4',
    color: '#303030',
  },
  meta: {
    fontSize: '11px',
    color: '#999',
    marginTop: 2,
    textTransform: 'uppercase',
    fontWeight: 500,
  },
  action: {
    marginLeft: theme.spacing(1),
  },
  downloadBtn: {
    minWidth: 'auto',
    padding: 8,
    borderRadius: '50%',
    backgroundColor: 'transparent',
    color: '#757575',
    '&:hover': {
        backgroundColor: 'rgba(0,0,0,0.05)',
        color: '#303030',
    }
  },
}));

const getFileIcon = (extension) => {
  const style = { fontSize: 32 };
  switch (extension) {
    case 'pdf':
      return <PictureAsPdf style={style} />;
    case 'doc':
    case 'docx':
    case 'txt':
    case 'rtf':
      return <Description style={style} />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <TableChart style={style} />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'webp':
      return <ImageIcon style={style} />;
    case 'mp3':
    case 'wav':
    case 'ogg':
      return <Audiotrack style={style} />;
    case 'mp4':
    case 'avi':
    case 'mkv':
    case 'mov':
      return <Videocam style={style} />;
    default:
      return <InsertDriveFile style={style} />;
  }
};

const getFileColor = (extension) => {
  switch (extension) {
    case 'pdf':
      return '#F44336'; // Material Red
    case 'doc':
    case 'docx':
      return '#2196F3'; // Material Blue
    case 'xls':
    case 'xlsx':
    case 'csv':
      return '#4CAF50'; // Material Green
    case 'ppt':
    case 'pptx':
      return '#FF9800'; // Material Orange
    case 'txt':
      return '#9E9E9E'; // Grey
    default:
      return '#7E57C2'; // Material Deep Purple (Generic)
  }
};

const FilePreview = ({ mediaUrl, filename }) => {
  const classes = useStyles();
  
  // Extract extension from mediaUrl first as it is more reliable for type
  let extension = '';
  if (mediaUrl) {
    const urlParts = mediaUrl.split('.').pop().split('?')[0].toLowerCase();
    if (urlParts.length <= 4) { // Likely an extension
      extension = urlParts;
    }
  }

  // Fallback to filename extension if mediaUrl didn't give a valid one
  if (!extension && filename && filename.includes('.')) {
    extension = filename.split('.').pop().toLowerCase();
  }

  // If still no extension, default
  if (!extension) extension = 'file';

  // Determine display filename
  // Priority: 1. Extract from mediaUrl (if format timestamp-name)
  //           2. filename prop (if it looks like a filename)
  //           3. default
  let displayFilename = null;

  if (mediaUrl) {
    const nameParts = mediaUrl.split('/').pop().split('-');
    // Check if first part is a timestamp (digits, length > 10)
    if (nameParts.length > 1 && /^\d{10,}$/.test(nameParts[0])) {
       displayFilename = nameParts.slice(1).join('-'); // Remove timestamp prefix
    }
  }

  if (!displayFilename) {
      // If filename prop looks like a file (has extension), use it
      if (filename && filename.toLowerCase().endsWith(`.${extension}`)) {
          displayFilename = filename;
      }
  }
  
  // Final fallback
  if (!displayFilename) {
      // If we couldn't extract from URL and filename prop doesn't look like a file,
      // we might just display "Document" or the extension, 
      // BUT if the filename prop IS the caption, we don't want to show it here usually?
      // Actually, for better UX, let's show the extension + "File" if we can't find a name.
      displayFilename = filename || `${extension.toUpperCase()} File`;
  }

  // Clean up underscores
  displayFilename = displayFilename.replace(/_/g, ' ');

  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension);

  return (
    <div className={classes.root}>
      {isImage && mediaUrl ? (
        <img src={mediaUrl} alt={displayFilename} className={classes.thumbnail} />
      ) : (
        <div 
          className={classes.iconContainer} 
          style={{ backgroundColor: getFileColor(extension) }}
        >
          {getFileIcon(extension)}
        </div>
      )}

      <div className={classes.details}>
        <Typography variant="body2" className={classes.filename} title={displayFilename}>
          {displayFilename}
        </Typography>
        <div className={classes.meta}>
           {extension.toUpperCase()} 
        </div>
      </div>

      <div className={classes.action}>
        <IconButton
          className={classes.downloadBtn}
          href={mediaUrl}
          target="_blank"
          download
          size="small"
        >
          <GetApp fontSize="small" />
        </IconButton>
      </div>
    </div>
  );
};

export default FilePreview;