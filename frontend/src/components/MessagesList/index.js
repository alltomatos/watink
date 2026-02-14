import React, { useState, useEffect, useReducer, useRef } from "react";

import { isSameDay, parseISO, format } from "date-fns";
import openSocket from "../../services/socket-io";
import clsx from "clsx";

import { green, blue } from "@material-ui/core/colors";
import {
  Button,
  CircularProgress,
  Divider,
  IconButton,
  makeStyles,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
} from "@material-ui/core";
import { Avatar } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import { lighten, darken } from "@material-ui/core/styles/colorManipulator";
import {
  AccessTime,
  Block,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
  History as HistoryIcon,
} from "@material-ui/icons";

import MarkdownWrapper from "../MarkdownWrapper";
import VcardPreview from "../VcardPreview";
import LocationPreview from "../LocationPreview";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import FilePreview from "../FilePreview";
import whatsBackground from "../../assets/wa-background.png";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { useThemeContext } from "../../context/DarkMode";
import Audio from "../Audio";
import { getBackendUrl } from "../../helpers/urlUtils";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
  },

  messagesList: {
    backgroundImage: `url(${whatsBackground})`,
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "20px 20px 20px 20px",
    overflowY: "scroll",
    [theme.breakpoints.down("sm")]: {
      paddingBottom: "90px",
    },
    ...theme.scrollbarStyles,
  },

  circleLoading: {
    color: green[500],
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12,
  },

  messageLeft: {
    marginRight: 20,
    marginTop: 2,
    maxWidth: 600,
    height: "auto",
    display: "flex",
    flexDirection: "column",
    width: "fit-content",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: "#ffffff",
    color: "#303030",
    alignSelf: "flex-start",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  messageLeftSaas: {
    backgroundColor: "#f3f4f6",
    color: "#303030",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0, // Tail on bottom left
    borderBottomRightRadius: 12,
    boxShadow: "none",
    border: "1px solid #e5e7eb",
  },

  quotedContainerLeft: {
    margin: "-3px -80px 6px -6px",
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef",
  },

  messageRight: {
    marginLeft: "auto",
    marginTop: 5,
    marginBottom: 15,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "flex",
    flexDirection: "column",
    width: "fit-content",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: "#dcf8c6",
    color: "#303030",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  messageRightSaas: {
    backgroundColor: theme.palette.primary.main,
    color: "#ffffff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 0, // Tail on bottom right
    boxShadow: "none",
  },

  quotedContainerRight: {
    margin: "-3px -80px 6px -6px",
    overflowY: "hidden",
    backgroundColor: "#cfe9ba",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
  },

  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "#999",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },

  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  textContentItemDeleted: {
    fontStyle: "italic",
    color: "rgba(0, 0, 0, 0.36)",
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  messageMedia: {
    objectFit: "cover",
    width: 330,
    height: "auto",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 5,
    color: "#999",
  },

  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "110px",
    backgroundColor: "#e1f3fb",
    margin: "10px",
    borderRadius: "10px",
    boxShadow: "0 1px 1px #b3b3b3",
  },

  dailyTimestampText: {
    color: "#808888",
    padding: 8,
    alignSelf: "center",
    marginLeft: "0px",
  },

  ackIcons: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginRight: 4,
  },

  ackDoneAllIcon: {
    color: blue[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
  },

  messageReactions: {
    position: "absolute",
    bottom: -10,
    left: 10,
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "2px 6px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    zIndex: 20,
    cursor: "pointer",
    border: "1px solid #e0e0e0",
  },

  urlPreviewContainer: {
    marginTop: 5,
    marginBottom: 5,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 8,
    overflow: "hidden",
    maxWidth: 300,
    border: "1px solid rgba(0,0,0,0.1)",
    cursor: "pointer",
  },
  urlPreviewImage: {
    width: "100%",
    height: 150,
    objectFit: "cover"
  },
  urlPreviewText: {
    padding: 10
  },
  urlPreviewTitle: {
    fontWeight: "bold",
    textDecoration: "none",
    color: "inherit",
    display: "block",
    marginBottom: 4,
    fontSize: 14,
  },
  urlPreviewDescription: {
    fontSize: 12,
    color: "#666",
    margin: 0,
    display: "-webkit-box",
    "-webkit-line-clamp": 3,
    "-webkit-box-orient": "vertical",
    overflow: "hidden"
  },
  groupMessageRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8
  },
  groupAvatar: {
    width: 32,
    height: 32,
    marginTop: 2
  },
  senderSpacer: {
    display: "block",
    height: 28,
    clear: "both"
  }
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload || [];
    const newMessages = [];

    messages.forEach((message) => {
      const messageIndex = state.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...newMessages, ...state].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    if (messageIndex !== -1) {
      state[messageIndex] = newMessage;
    } else {
      state.push(newMessage);
    }

    return [...state].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      state[messageIndex] = messageToUpdate;
    }

    return [...state].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  if (action.type === "RESET") {
    return [];
  }
};

const MessagesList = ({ ticketId, isGroup }) => {
  const classes = useStyles();
  const muiTheme = useTheme();
  const { appTheme } = useThemeContext();

  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const lastMessageRef = useRef();

  const [selectedMessage, setSelectedMessage] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const currentTicketId = useRef(ticketId);
  const shouldScrollRef = useRef();
  const messagesListRef = useRef();

  // Estado para modal de busca de histórico
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);

    currentTicketId.current = ticketId;
  }, [ticketId]);

  useEffect(() => {
    if (shouldScrollRef.current) {
      scrollToBottom(shouldScrollRef.current === "smooth" ? "smooth" : "auto");
      shouldScrollRef.current = null;
    }
  }, [messagesList]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchMessages = async () => {
        try {
          const { data } = await api.get("/messages/" + ticketId, {
            params: { pageNumber },
          });

          if (currentTicketId.current === ticketId) {
            dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
            setHasMore(data.hasMore);
            setLoading(false);
          }

          if (pageNumber === 1 && data.messages.length > 0) {
            shouldScrollRef.current = "auto";
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchMessages();
    }, 500);
    return () => {
      clearTimeout(delayDebounceFn);
    };
  }, [pageNumber, ticketId]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("connect", () => socket.emit("joinChatBox", ticketId));

    socket.on("appMessage", (data) => {
      if (data.action === "create") {
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
        shouldScrollRef.current = "smooth";
      }

      if (data.action === "update") {
        dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId]);

  const loadMore = () => {
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

  const scrollToBottom = (behavior = "auto") => {
    if (pageNumber > 1) {
      return;
    }
    setTimeout(() => {
      if (lastMessageRef.current) {
        lastMessageRef.current.scrollIntoView({ behavior });
      }
    }, 100);
  };

  const handleScroll = (e) => {
    if (!hasMore) return;
    const { scrollTop } = e.currentTarget;

    if (scrollTop === 0) {
      // document.getElementById("messagesList").scrollTop = 1;
      messagesListRef.current.scrollTop = 1;
    }

    if (loading) {
      return;
    }

    if (scrollTop < 50) {
      loadMore();
    }
  };

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  // Handler para buscar histórico de mensagens
  const handleSyncHistory = async () => {
    if (!historyFromDate) {
      toast.error("Selecione uma data de início");
      return;
    }

    setHistoryLoading(true);
    try {
      await api.post(`/tickets/${ticketId}/history`, {
        fromDate: historyFromDate
      });
      toast.success("Buscando histórico de mensagens...");
      setHistoryModalOpen(false);
      setHistoryFromDate("");
    } catch (err) {
      toastError(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const checkMessageMedia = (message) => {
    if (message.mediaType === "location" && message.body.split('|').length >= 2) {
      let locationParts = message.body.split('|')
      let imageLocation = locationParts[0]
      let linkLocation = locationParts[1]

      let descriptionLocation = null

      if (locationParts.length > 2)
        descriptionLocation = message.body.split('|')[2]

      return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />
    }
    else if (message.mediaType === "vcard") {
      //console.log("vcard")
      //console.log(message)
      let array = message.body.split("\n");
      let obj = [];
      let contact = "";
      for (let index = 0; index < array.length; index++) {
        const v = array[index];
        let values = v.split(":");
        for (let ind = 0; ind < values.length; ind++) {
          if (values[ind].indexOf("+") !== -1) {
            obj.push({ number: values[ind] });
          }
          if (values[ind].indexOf("FN") !== -1) {
            contact = values[ind + 1];
          }
        }
      }
      return <VcardPreview contact={contact} numbers={obj[0]?.number} />
    }
    /*else if (message.mediaType === "multi_vcard") {
      console.log("multi_vcard")
      console.log(message)
    	
      if(message.body !== null && message.body !== "") {
        let newBody = JSON.parse(message.body)
        return (
          <>
            {
            newBody.map(v => (
              <VcardPreview contact={v.name} numbers={v.number} />
            ))
            }
          </>
        )
      } else return (<></>)
    }*/
    else if (message.mediaType === "image" || message.mediaType === "sticker") {
      return <ModalImageCors imageUrl={getBackendUrl(message.mediaUrl)} />;
    } else if (message.mediaType === "audio") {
      return <Audio url={getBackendUrl(message.mediaUrl)} />
    } else if (message.mediaType === "video") {
      return (
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px', borderRadius: 8, overflow: 'hidden' }}>
          <video
            src={getBackendUrl(message.mediaUrl)}
            controls
            style={{ width: '100%', height: 'auto', maxHeight: '300px', objectFit: 'contain', backgroundColor: '#000' }}
          />
        </div>
      );

    } else if (message.mediaType === "carousel") {
      let data = message.dataJson;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch (e) { data = {}; }
      }
      if (data?.cards) {
        return (
          <div style={{ display: 'flex', overflowX: 'auto', maxWidth: 350, gap: 10, paddingBottom: 10, paddingTop: 5 }}>
            {data.cards.map((card, idx) => (
              <div key={idx} style={{ minWidth: 220, backgroundColor: '#fff', borderRadius: 8, border: '1px solid #eee', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                {card.headerUrl && <img src={card.headerUrl} style={{ width: '100%', height: 120, objectFit: 'cover' }} alt={card.title} />}
                <div style={{ padding: 8 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>{card.title}</div>
                  <div style={{ fontSize: 12, color: '#555', whiteSpace: 'pre-wrap' }}>{card.body}</div>
                </div>
                {card.buttons && card.buttons.length > 0 && (
                  <div style={{ borderTop: '1px solid #f0f0f0', padding: 5 }}>
                    {card.buttons.map((btn, bIdx) => (
                      <div key={bIdx} style={{ fontSize: 12, textAlign: 'center', color: '#007bff', padding: '4px 0', cursor: 'pointer' }}
                        onClick={() => btn.url ? window.open(btn.url, '_blank') : null}
                      >
                        {btn.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
      return null;
    } else {
      return (
        <>
          <FilePreview mediaUrl={getBackendUrl(message.mediaUrl)} filename={message.body} />
        </>
      );
    }
  };

  const renderMessageAck = (message) => {
    // Hide read receipts in group chats - unnecessary
    if (isGroup) {
      return null;
    }

    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 2) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 3 || message.ack === 4) {
      return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />;
    }
    if (message.ack === 5) {
      return <ErrorOutline fontSize="small" className={classes.ackErrorIcon} style={{ color: "#f44336" }} />;
    }
  };

  const isDateValid = (dateStr) => {
    if (!dateStr) return false;
    const date = parseISO(dateStr);
    return !isNaN(date.getTime()) && date.getFullYear() > 2000;
  };

  const renderDailyTimestamps = (message, index) => {
    if (!isDateValid(message.createdAt)) return null;

    if (index === 0) {
      return (
        <span
          className={classes.dailyTimestamp}
          key={`timestamp-${message.id}`}
        >
          <div className={classes.dailyTimestampText}>
            {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
          </div>
        </span>
      );
    }
    if (index > 0) {
      if (!isDateValid(messagesList[index - 1].createdAt)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
            </div>
          </span>
        );
      }

      let messageDay = parseISO(messagesList[index].createdAt);
      let previousMessageDay = parseISO(messagesList[index - 1].createdAt);

      if (!isSameDay(messageDay, previousMessageDay)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
            </div>
          </span>
        );
      }
    }
  };

  const renderMessageTimestamp = (message) => {
    if (!isDateValid(message.createdAt)) return null;
    return (
      <span className={classes.timestamp}>
        {format(parseISO(message.createdAt), "HH:mm")}
        {renderMessageAck(message)}
      </span>
    )
  };

  const groupColorCacheRef = useRef(new Map());

  const getParticipantColor = (message) => {
    const participantId = message.participant || message.dataJson?.participant || "unknown";
    if (!groupColorCacheRef.current.has(participantId)) {
      const colors = [
        "#FF5722", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3",
        "#03A9F4", "#00BCD4", "#009688", "#4CAF50", "#8BC34A", "#CDDC39",
        "#FFC107", "#FF9800", "#795548", "#607D8B"
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      groupColorCacheRef.current.set(participantId, randomColor);
    }
    return groupColorCacheRef.current.get(participantId);
  };



  const getMessageBody = (message) => {
    if (message.mediaType === "location") return "Localização";
    if (message.mediaType === "vcard") return "Contato";
    if (message.mediaType === "carousel") return "Carrossel";
    return message.body;
  };

  const renderQuotedMessage = (message) => {
    const getQuotedSenderName = () => {
      const quotedMsg = message.quotedMsg;
      const contact = quotedMsg?.contact;

      if (isGroup && contact?.isGroup && quotedMsg?.participant) {
        let data = quotedMsg.dataJson;
        if (typeof data === "string") {
          try { data = JSON.parse(data); } catch (e) { data = {}; }
        }
        if (data?.pushName) return data.pushName;
        return quotedMsg.participant.replace("@s.whatsapp.net", "");
      }

      return contact?.name;
    }

    return (
      <div
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={message.fromMe ? classes.quotedMsgRight : classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName}>
              {(() => {
                const quoted = message.quotedMsg;
                let pushName = null;
                let participantNumber = null;

                if (quoted.dataJson) {
                  try {
                    const data = typeof quoted.dataJson === 'string' ? JSON.parse(quoted.dataJson) : quoted.dataJson;
                    pushName = data.pushName;
                  } catch (e) { }
                }

                if (quoted.participant) {
                  participantNumber = quoted.participant.replace(/\D/g, "");
                }

                if (pushName) return `~${pushName}`;
                if (participantNumber) return `~${participantNumber}`;

                return quoted.contact?.name;
              })()}
            </span>
          )}
          {getMessageBody(message.quotedMsg)}
        </div>
      </div>
    );
  };

  const renderMessageReactions = (message) => {
    if (!message.reactions || message.reactions.length === 0) return null;

    const aggregated = message.reactions.reduce((acc, curr) => {
      const emoji = curr.text || curr.emoji;
      if (!emoji) return acc;

      const existing = acc.find((r) => r.emoji === emoji);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ emoji, count: 1 });
      }
      return acc;
    }, []);

    return (
      <div className={classes.messageReactions}>
        {aggregated.map((reaction, index) => (
          <span key={index} style={{ marginRight: 4 }}>
            {reaction.emoji} {reaction.count > 1 ? reaction.count : ""}
          </span>
        ))}
      </div>
    );
  };

  const getFileNameFromUrl = (url) => {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      return pathname.substring(pathname.lastIndexOf('/') + 1);
    } catch (e) {
      return url;
    }
  };

  const renderUrlPreview = (message) => {
    let data = message.dataJson;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (e) { data = {}; }
    }
    if (!data?.preview) return null;

    return (
      <div className={classes.urlPreviewContainer} onClick={() => window.open(data.preview.url, '_blank')}>
        {data.preview.image && (
          <img src={data.preview.image} alt={data.preview.title} className={classes.urlPreviewImage} />
        )}
        <div className={classes.urlPreviewText}>
          <a href={data.preview.url} target="_blank" rel="noopener noreferrer" className={classes.urlPreviewTitle}>
            {data.preview.title}
          </a>
          <p className={classes.urlPreviewDescription}>
            {data.preview.description}
          </p>
        </div>
      </div>
    );
  };

  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const { data } = await api.get(`/tickets/${ticketId}/participants`);
        setParticipants(data);
      } catch (err) {
        // console.error(err);
      }
    }
    if (isGroup) {
      fetchParticipants();
    }
  }, [ticketId, isGroup]);

  const mentionsMap = React.useMemo(() => {
    const map = {};
    if (messagesList && messagesList.length > 0) {
      messagesList.forEach((msg) => {
        let number = null;
        let pushName = null;

        if (msg.participant) {
          number = msg.participant.replace(/\D/g, "");
          try {
            const data = typeof msg.dataJson === 'string' ? JSON.parse(msg.dataJson) : msg.dataJson;
            pushName = data?.pushName;
          } catch (e) { }
        }

        if (msg.contact) {
          if (!number) number = msg.contact.number;
          if (!pushName) pushName = msg.contact.name;
        }

        if (number && pushName) {
          map[number] = pushName;
        }
      });
    }

    // Merge participants from API
    participants.forEach(p => {
      if (p.number && p.name) {
        const number = p.number.replace(/\D/g, "");
        if (!map[number]) {
          map[number] = p.name;
        }
      }
    });

    return map;
  }, [messagesList, participants]);

  const renderSenderName = (message) => {
    if (!isGroup) return null;
    if (message.fromMe) return null;

    let pushName = null;
    let participantNumber = null;

    if (message.dataJson) {
      const data = typeof message.dataJson === 'string' ? JSON.parse(message.dataJson) : message.dataJson;
      pushName = data.pushName;
    }

    if (message.participant) {
      participantNumber = message.participant.replace(/\D/g, "");
    }

    const displayName = pushName || participantNumber || "Unknown";
    const color = getParticipantColor(message);

    return (
      <span className={classes.messageContactName} style={{ color }}>
        {displayName}
      </span>
    );
  };

  const renderMessages = () => {
    if (messagesList.length > 0) {
      const getSenderKey = (m) => {
        if (!m) return "unknown";
        if (m.fromMe) return "me";
        if (isGroup) {
          let data = m.dataJson;
          if (typeof data === "string") {
            try { data = JSON.parse(data); } catch (e) { data = {}; }
          }
          return m.participant || data?.participant || data?.senderLid || data?.pushName || "unknown";
        }
        return "other";
      };

      const getDeletedBy = (message) => {
        let data = message.dataJson;
        if (typeof data === "string") {
          try { data = JSON.parse(data); } catch (e) { data = {}; }
        }
        return data?.deletedBy;
      };

      const renderDeletedMessage = (message) => {
        if (!message.isDeleted) return null;
        const deletedBy = getDeletedBy(message);
        return (
          <div style={{ fontSize: 13, color: "rgba(0, 0, 0, 0.5)", fontStyle: "italic", marginBottom: 5 }}>
            <Block fontSize="small" style={{ fontSize: 16, marginRight: 5, verticalAlign: "bottom" }} />
            {deletedBy ? `Mensagem apagada por: ${deletedBy}` : "Mensagem apagada"}
          </div>
        );
      };

      const renderMessageDivider = (message, index) => {
        if (index <= 0 || index >= messagesList.length) return null;
        const currentKey = getSenderKey(messagesList[index]);
        const previousKey = getSenderKey(messagesList[index - 1]);
        if (currentKey !== previousKey) {
          return <span className={classes.senderSpacer} key={`divider-${message.id}`} />;
        }
      };

      const viewMessagesList = messagesList.map((message, index) => {
        const currentSenderKey = (() => {
          if (message.fromMe) return "me";
          if (isGroup) {
            return message.participant ||
              (message.dataJson && (
                (typeof message.dataJson === 'string' ? JSON.parse(message.dataJson) : message.dataJson)?.participant ||
                (typeof message.dataJson === 'string' ? JSON.parse(message.dataJson) : message.dataJson)?.senderLid
              )) ||
              message.contact?.number ||
              "unknown";
          }
          return "other";
        })();

        const previousSenderKey = index > 0 ? (() => {
          const prev = messagesList[index - 1];
          if (prev.fromMe) return "me";
          if (isGroup) {
            return prev.participant ||
              (prev.dataJson && (
                (typeof prev.dataJson === 'string' ? JSON.parse(prev.dataJson) : prev.dataJson)?.participant ||
                (typeof prev.dataJson === 'string' ? JSON.parse(prev.dataJson) : prev.dataJson)?.senderLid
              )) ||
              prev.contact?.number ||
              "unknown";
          }
          return "other";
        })() : null;

        const isSameSender = currentSenderKey === previousSenderKey;
        const isSameDayMsg = index > 0 && isSameDay(parseISO(message.createdAt), parseISO(messagesList[index - 1].createdAt));
        const showGroupInfo = !isSameSender || !isSameDayMsg;

        if (!message.fromMe) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderMessageDivider(message, index)}
              <div className={isGroup ? classes.groupMessageRow : undefined}>
                {isGroup && (
                  showGroupInfo ? (
                    <Avatar
                      className={classes.groupAvatar}
                      src={(function () {
                        let data = message.dataJson;
                        if (typeof data === "string") {
                          try { data = JSON.parse(data); } catch (e) { data = {}; }
                        }
                        const url = data?.profilePicUrl || "";
                        return getBackendUrl(url);
                      })()}
                    />
                  ) : (
                    <div className={classes.groupAvatar} />
                  )
                )}
                <div
                  className={clsx(classes.messageLeft, {
                    [classes.messageLeftSaas]: appTheme === "saas",
                  })}
                  style={{
                    marginTop: showGroupInfo ? 10 : 2,
                    maxWidth: (message.mediaUrl || message.mediaType === "image" || message.mediaType === "video" || message.mediaType === "location") ? 332 : 600
                  }}
                >
                  <IconButton
                    variant="contained"
                    size="small"
                    id="messageActionsButton"
                    disabled={message.isDeleted}
                    className={classes.messageActionsButton}
                    onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                  >
                    <ExpandMore />
                  </IconButton>
                  {showGroupInfo && renderSenderName(message)}
                  {(message.mediaUrl || message.mediaType === "location" || message.mediaType === "vcard") && checkMessageMedia(message)}
                  <div className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
                  })}>
                    {renderDeletedMessage(message)}
                    {message.quotedMsg && renderQuotedMessage(message)}
                    {renderUrlPreview(message)}
                    {(message.mediaUrl && getFileNameFromUrl(message.mediaUrl) === message.body) ? null :
                      <MarkdownWrapper mentionsMap={mentionsMap}>{getMessageBody(message)}</MarkdownWrapper>
                    }

                    {renderMessageTimestamp(message)}
                  </div>
                  {renderMessageReactions(message)}
                </div >
              </div >
            </React.Fragment >
          );
        } else {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderMessageDivider(message, index)}
              <div
                className={clsx(classes.messageRight, {
                  [classes.messageRightSaas]: appTheme === "saas",
                })}
                style={{ marginTop: showGroupInfo ? 10 : 2, maxWidth: (message.mediaUrl || message.mediaType === "image" || message.mediaType === "video" || message.mediaType === "location") ? 332 : 600 }}
              >
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {(message.mediaUrl || message.mediaType === "location" || message.mediaType === "vcard" || message.mediaType === "carousel"
                  //|| message.mediaType === "multi_vcard" 
                ) && checkMessageMedia(message)}
                <div
                  className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
                  })}
                >
                  {renderDeletedMessage(message)}
                  {message.quotedMsg && renderQuotedMessage(message)}
                  {renderUrlPreview(message)}
                  {(message.mediaUrl && getFileNameFromUrl(message.mediaUrl) === message.body) ? null :
                    <MarkdownWrapper mentionsMap={mentionsMap}>{getMessageBody(message)}</MarkdownWrapper>
                  }
                  {renderMessageTimestamp(message)}
                </div>
                {renderMessageReactions(message)}
              </div>
            </React.Fragment>
          );
        }
      });
      return viewMessagesList;
    } else {
      return <div>Say hello to your new contact!</div>;
    }
  };

  return (
    <div className={classes.messagesListWrapper}>
      <MessageOptionsMenu
        message={selectedMessage}
        anchorEl={anchorEl}
        menuOpen={messageOptionsMenuOpen}
        handleClose={handleCloseMessageOptionsMenu}
      />



      {/* Modal de seleção de data para histórico */}
      <Dialog
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Buscar Histórico de Mensagens</DialogTitle>
        <DialogContent>
          <TextField
            label="Data de início"
            type="date"
            value={historyFromDate}
            onChange={(e) => setHistoryFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            margin="dense"
            helperText="Selecione a data a partir da qual deseja buscar as mensagens"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setHistoryModalOpen(false)}
            color="secondary"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSyncHistory}
            color="primary"
            variant="contained"
            disabled={historyLoading || !historyFromDate}
          >
            {historyLoading ? <CircularProgress size={20} /> : "Buscar"}
          </Button>
        </DialogActions>
      </Dialog>

      <div
        id="messagesList"
        className={classes.messagesList}
        onScroll={handleScroll}
        ref={messagesListRef}
      >
        {messagesList.length > 0 ? renderMessages() : []}
        <div ref={lastMessageRef} />
      </div>
      {loading && (
        <div>
          <CircularProgress className={classes.circleLoading} />
        </div>
      )}
    </div>
  );
};

export default MessagesList;

