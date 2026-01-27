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
import Role from "./Role";
import Permission from "./Permission";
import Tenant from "./Tenant";

@Table
class RolePermission extends Model<RolePermission> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Role)
    @Column
    roleId: number;

    @ForeignKey(() => Permission)
    @Column
    permissionId: number;

    @Column(DataType.JSONB)
    scope: any;

    @Column(DataType.JSONB)
    conditions: any;

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

export default RolePermission;
