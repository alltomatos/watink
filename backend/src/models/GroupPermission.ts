import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    ForeignKey,
    PrimaryKey,
    AutoIncrement,
    DataType
} from "sequelize-typescript";
import Group from "./Group";
import Permission from "./Permission";
import Tenant from "./Tenant";

@Table
class GroupPermission extends Model<GroupPermission> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Group)
    @Column
    groupId: number;

    @ForeignKey(() => Permission)
    @Column
    permissionId: number;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: number | string;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default GroupPermission;
