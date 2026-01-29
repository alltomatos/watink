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
import Role from "./Role";
import GroupRole from "./GroupRole";
import Tenant from "./Tenant";
import UserGroup from "./UserGroup";


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

    // Nova relação Many-to-Many: Um grupo pode ter múltiplos usuários
    @BelongsToMany(() => User, () => UserGroup)
    users: User[];

    @BelongsToMany(() => Role, () => GroupRole)
    roles: Role[];



    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default Group;
