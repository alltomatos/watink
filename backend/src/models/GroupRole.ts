import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    DataType,
    ForeignKey,
    PrimaryKey,
    AutoIncrement,
    BelongsTo
} from "sequelize-typescript";
import Group from "./Group";
import Role from "./Role";
import Tenant from "./Tenant";

@Table
class GroupRole extends Model<GroupRole> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Group)
    @Column
    groupId: number;

    @ForeignKey(() => Role)
    @Column
    roleId: number;

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

export default GroupRole;
