import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    PrimaryKey,
    ForeignKey,
    BelongsTo,
    AutoIncrement,
    DataType
} from "sequelize-typescript";

import Contact from "./Contact";
import Ticket from "./Ticket";
import Tenant from "./Tenant";

@Table({
    tableName: "ConversationEmbeddings",
    timestamps: true
})
class ConversationEmbedding extends Model<ConversationEmbedding> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

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

    @Column(DataType.TEXT)
    summary: string;

    @Column(DataType.JSONB)
    topics: string[];

    @Column(DataType.FLOAT)
    sentiment: number;

    @Column({ defaultValue: 0 })
    messageCount: number;

    @Column(DataType.ARRAY(DataType.FLOAT))
    embedding: number[];

    @Column(DataType.JSONB)
    metadata: Record<string, any>;

    @Column
    processedAt: Date;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: number | string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default ConversationEmbedding;
