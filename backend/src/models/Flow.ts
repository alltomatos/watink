import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    DataType,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    BelongsTo
} from "sequelize-typescript";
import Tenant from "./Tenant";
import User from "./User";
import Whatsapp from "./Whatsapp";

@Table
class Flow extends Model<Flow> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @Column
    name: string;

    @Column({
        type: DataType.JSONB,
        defaultValue: []
    })
    nodes: object[];

    @Column({
        type: DataType.JSONB,
        defaultValue: []
    })
    edges: object[];

    @ForeignKey(() => Tenant)
    @Column
    tenantId: string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @ForeignKey(() => User)
    @Column
    @Column
    userId: number;

    @BelongsTo(() => User)
    user: User;

    @ForeignKey(() => Whatsapp)
    @Column
    whatsappId: number;

    @BelongsTo(() => Whatsapp)
    whatsapp: Whatsapp;

    @Column({ defaultValue: true })
    isActive: boolean;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default Flow;
