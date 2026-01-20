import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    AllowNull,
    Default,
    ForeignKey,
    BelongsTo,
    HasMany,
    DataType
} from "sequelize-typescript";
import Queue from "./Queue";
import Tenant from "./Tenant";
import Ticket from "./Ticket";

@Table
class Step extends Model<Step> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @AllowNull(false)
    @Column(DataType.STRING(100))
    name: string;

    @AllowNull(true)
    @Default("#808080")
    @Column(DataType.STRING(20))
    color: string;

    @AllowNull(false)
    @Default(0)
    @Column
    order: number;

    @AllowNull(false)
    @Default(false)
    @Column({
        comment: "When true, moving a ticket to this step binds the contact to the assigned user wallet"
    })
    isBindingStep: boolean;

    @ForeignKey(() => Queue)
    @AllowNull(false)
    @Column
    queueId: number;

    @BelongsTo(() => Queue)
    queue: Queue;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: number | string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @HasMany(() => Ticket)
    tickets: Ticket[];

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default Step;
