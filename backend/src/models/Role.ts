import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    DataType,
    PrimaryKey,
    AutoIncrement,
    HasMany,
    BelongsToMany,
    ForeignKey,
    BelongsTo
} from "sequelize-typescript";
import Tenant from "./Tenant";
import User from "./User";
import UserRole from "./UserRole";
import Permission from "./Permission";
import RolePermission from "./RolePermission";

@Table
class Role extends Model<Role> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @Column(DataType.STRING)
    name: string;

    @Column(DataType.STRING)
    description: string;

    @Column({ defaultValue: false })
    isSystem: boolean;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: number | string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @BelongsToMany(() => User, () => UserRole)
    users: User[];

    @BelongsToMany(() => Permission, () => RolePermission)
    permissions: Permission[];

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default Role;
