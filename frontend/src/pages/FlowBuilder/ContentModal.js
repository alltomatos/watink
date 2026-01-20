import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    Typography,
    Box,
    makeStyles,
    IconButton
} from '@material-ui/core';
import {
    TextFields as TextIcon,
    Schedule as IntervalIcon,
    Image as ImageIcon,
    Description as FileIcon,
    Mic as AudioIcon,
    Videocam as VideoIcon,
    Close as CloseIcon
} from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
    dialogTitle: {
        borderBottom: '1px solid #e0e0e0',
        padding: theme.spacing(2),
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    optionButton: {
        width: '100%',
        height: '50px',
        color: '#fff',
        fontWeight: 'bold',
        textTransform: 'none',
        display: 'flex',
        justifyContent: 'flex-start',
        paddingLeft: theme.spacing(2),
        gap: theme.spacing(1),
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        '&:hover': {
            opacity: 0.9,
            transform: 'translateY(-1px)'
        }
    },
    variablesContainer: {
        marginTop: theme.spacing(3),
        padding: theme.spacing(2),
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        border: '1px solid #eee'
    },
    variableItem: {
        marginBottom: theme.spacing(1),
        fontSize: '0.9rem',
        '& strong': {
            fontFamily: 'monospace',
            backgroundColor: '#e0e0e0',
            padding: '2px 4px',
            borderRadius: 4
        }
    }
}));

const ContentModal = ({ open, onClose, onAdd }) => {
    const classes = useStyles();

    const handleOptionClick = (type) => {
        // Por enquanto, apenas fecha e retorna o tipo. 
        // Futuramente pode abrir sub-configuração específica para cada tipo.
        onAdd(type);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <div className={classes.dialogTitle}>
                <Typography variant="h6">Adicionar conteúdo ao fluxo</Typography>
                <IconButton size="small" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </div>
            
            <DialogContent dividers>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4} md={2}>
                        <Button
                            className={classes.optionButton}
                            style={{ backgroundColor: '#2196f3' }} // Azul
                            onClick={() => handleOptionClick('text')}
                        >
                            <TextIcon /> Texto
                        </Button>
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                        <Button
                            className={classes.optionButton}
                            style={{ backgroundColor: '#4caf50' }} // Verde
                            onClick={() => handleOptionClick('interval')}
                        >
                            <IntervalIcon /> Intervalo
                        </Button>
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                        <Button
                            className={classes.optionButton}
                            style={{ backgroundColor: '#ff9800' }} // Laranja
                            onClick={() => handleOptionClick('image')}
                        >
                            <ImageIcon /> Imagem
                        </Button>
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                        <Button
                            className={classes.optionButton}
                            style={{ backgroundColor: '#3f51b5' }} // Azul Escuro
                            onClick={() => handleOptionClick('file')}
                        >
                            <FileIcon /> Arquivo
                        </Button>
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                        <Button
                            className={classes.optionButton}
                            style={{ backgroundColor: '#9c27b0' }} // Roxo
                            onClick={() => handleOptionClick('audio')}
                        >
                            <AudioIcon /> Audio
                        </Button>
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                        <Button
                            className={classes.optionButton}
                            style={{ backgroundColor: '#f44336' }} // Vermelho
                            onClick={() => handleOptionClick('video')}
                        >
                            <VideoIcon /> Video
                        </Button>
                    </Grid>
                </Grid>

                <Box className={classes.variablesContainer}>
                    <Typography variant="subtitle1" gutterBottom style={{ fontWeight: 'bold' }}>
                        Variáveis
                    </Typography>
                    
                    <div className={classes.variableItem}>
                        <strong>{`{{firstName}}`}</strong>: Retorna o primeiro nome do contato relacionado ao ticket. Se não houver contato, retorna uma string vazia.
                    </div>
                    <div className={classes.variableItem}>
                        <strong>{`{{name}}`}</strong>: O nome completo do contato (ou uma string vazia se não houver contato).
                    </div>
                    <div className={classes.variableItem}>
                        <strong>{`{{userName}}`}</strong>: O nome do usuário associado ao ticket. Se não houver usuário, retorna uma string vazia.
                    </div>
                    <div className={classes.variableItem}>
                        <strong>{`{{ms}}`}</strong>: Retorna uma saudação com base no horário atual (Exemplo: "Bom Dia", "Boa Tarde").
                    </div>
                    <div className={classes.variableItem}>
                        <strong>{`{{protocol}}`}</strong>: Combinação de control() e o ID do ticket, criando um protocolo único.
                    </div>
                    <div className={classes.variableItem}>
                        <strong>{`{{date}}`}</strong>: Retorna a data atual no formato dd-mm-yyyy.
                    </div>
                    <div className={classes.variableItem}>
                        <strong>{`{{hour}}`}</strong>: Retorna a hora atual no formato hh:mm:ss.
                    </div>
                    <div className={classes.variableItem}>
                        <strong>{`{{ticket_id}}`}</strong>: O ID do ticket, se existir. Caso contrário, retorna uma string vazia.
                    </div>
                    <div className={classes.variableItem}>
                        <strong>{`{{queue}}`}</strong>: Retorna o nome da fila à qual o ticket está associado (caso exista).
                    </div>
                    <div className={classes.variableItem}>
                        <strong>{`{{connection}}`}</strong>: Retorna o nome da conexão de WhatsApp associada ao ticket.
                    </div>
                </Box>
            </DialogContent>

            <DialogActions style={{ padding: 16 }}>
                <Button 
                    onClick={onClose} 
                    variant="contained" 
                    style={{ backgroundColor: '#f44336', color: '#fff' }}
                >
                    Cancelar
                </Button>
                {/* O botão adicionar geralmente confirma uma seleção, mas aqui os botões de cima já fazem a ação. 
                    Vou manter apenas como fechamento ou confirmação genérica se necessário.
                    Na imagem parece ser um 'submit' do modal. */}
                <Button 
                    onClick={onClose} 
                    variant="contained" 
                    color="primary"
                >
                    Adicionar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ContentModal;
