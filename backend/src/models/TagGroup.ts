import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    BelongsTo,
    DataType,
    Default,
    AllowNull
} from "sequelize-typescript";
import Tenant from "./Tenant";

@Table({ tableName: "TagGroups" })
class TagGroup extends Model<TagGroup> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @Column(DataType.STRING(100))
    name: string;

    @AllowNull(true)
    @Column(DataType.STRING(255))
    description: string;

    @Default(0)
    @Column
    order: number;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default TagGroup;
