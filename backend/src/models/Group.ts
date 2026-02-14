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
import User from "./User";
import Permission from "./Permission";
import GroupPermission from "./GroupPermission";
import Tenant from "./Tenant";

@Table
class Group extends Model<Group> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @Column(DataType.STRING)
    name: string;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: number | string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @HasMany(() => User, { sourceKey: "id", foreignKey: "groupId", as: "users" })
    users: User[];

    @BelongsToMany(() => Permission, () => GroupPermission)
    permissions: Permission[];

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default Group;
