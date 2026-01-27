import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    ForeignKey,
    PrimaryKey,
    AutoIncrement
} from "sequelize-typescript";
import User from "./User";
import Permission from "./Permission";
import Tenant from "./Tenant";

@Table
class UserPermission extends Model<UserPermission> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => User)
    @Column
    userId: number;

    @ForeignKey(() => Permission)
    @Column
    permissionId: number;

    @ForeignKey(() => Tenant)
    @Column
    tenantId: number;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default UserPermission;
