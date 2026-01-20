import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    BelongsTo,
    HasMany,
    DataType,
    Default,
} from "sequelize-typescript";
import Tenant from "./Tenant";
import Ticket from "./Ticket";
import Contact from "./Contact";
import User from "./User";
import ProtocolHistory from "./ProtocolHistory";
import ProtocolAttachment from "./ProtocolAttachment";

@Table({ tableName: "Protocols" })
class Protocol extends Model<Protocol> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @Column(DataType.STRING(50))
    protocolNumber: string;

    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    token: string;

    @ForeignKey(() => Ticket)
    @Column
    ticketId: number;

    @BelongsTo(() => Ticket)
    ticket: Ticket;

    @ForeignKey(() => Contact)
    @Column
    contactId: number;

    @BelongsTo(() => Contact)
    contact: Contact;

    @ForeignKey(() => User)
    @Column
    userId: number;

    @BelongsTo(() => User)
    user: User;

    @Column(DataType.STRING(255))
    subject: string;

    @Column(DataType.TEXT)
    description: string;

    @Default("open")
    @Column(DataType.STRING(20))
    status: string; // open, in_progress, pending, resolved, closed

    @Default("medium")
    @Column(DataType.STRING(20))
    priority: string; // low, medium, high, urgent

    @Column(DataType.STRING(100))
    category: string;

    @Column(DataType.DATE)
    dueDate: Date;

    @Column(DataType.DATE)
    resolvedAt: Date;

    @Column(DataType.DATE)
    closedAt: Date;

    @HasMany(() => ProtocolHistory)
    history: ProtocolHistory[];

    @HasMany(() => ProtocolAttachment)
    attachments: ProtocolAttachment[];

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default Protocol;
