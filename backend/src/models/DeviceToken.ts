import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    DataType,
    ForeignKey,
    BelongsTo
} from "sequelize-typescript";
import User from "./User";
import Tenant from "./Tenant";

@Table({ tableName: "DeviceTokens" })
class DeviceToken extends Model<DeviceToken> {
    @Column({
        primaryKey: true,
        autoIncrement: true
    })
    id: number;

    @Column(DataType.STRING)
    token: string;

    @Column(DataType.STRING)
    platform: string;

    @ForeignKey(() => User)
    @Column
    userId: number;

    @BelongsTo(() => User)
    user: User;

    @ForeignKey(() => Tenant)
    @Column
    tenantId: number;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default DeviceToken;
