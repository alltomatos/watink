import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    DataType,
    PrimaryKey,
    AutoIncrement,
    BelongsToMany
} from "sequelize-typescript";
import Role from "./Role";
import RolePermission from "./RolePermission";

@Table
class Permission extends Model<Permission> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @Column(DataType.STRING)
    resource: string;

    @Column(DataType.STRING)
    action: string;

    @Column(DataType.STRING)
    description: string;

    @Column({ defaultValue: true })
    isSystem: boolean;

    @BelongsToMany(() => Role, () => RolePermission)
    roles: Role[];

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default Permission;
