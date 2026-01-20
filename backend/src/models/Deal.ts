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
    DataType,
    Default
} from "sequelize-typescript";
import Contact from "./Contact";
import Ticket from "./Ticket";
import Pipeline from "./Pipeline";
import PipelineStage from "./PipelineStage";
import Tenant from "./Tenant";

@Table
class Deal extends Model<Deal> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @Column
    title: string;

    @Default(0.00)
    @Column(DataType.DECIMAL(10, 2))
    value: number;

    @Default(1)
    @Column
    priority: number;

    @ForeignKey(() => Contact)
    @Column
    contactId: number;

    @BelongsTo(() => Contact)
    contact: Contact;

    @ForeignKey(() => Ticket)
    @Column
    ticketId: number;

    @BelongsTo(() => Ticket)
    ticket: Ticket;

    @ForeignKey(() => Pipeline)
    @Column
    pipelineId: number;

    @BelongsTo(() => Pipeline)
    pipeline: Pipeline;

    @ForeignKey(() => PipelineStage)
    @Column
    stageId: number;

    @BelongsTo(() => PipelineStage)
    stage: PipelineStage;

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

export default Deal;
