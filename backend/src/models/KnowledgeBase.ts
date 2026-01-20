import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    AllowNull,
    ForeignKey,
    BelongsTo,
    HasMany,
    DataType
} from "sequelize-typescript";
import Tenant from "./Tenant";
import KnowledgeSource from "./KnowledgeSource";

@Table
class KnowledgeBase extends Model<KnowledgeBase> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @AllowNull(false)
    @Column
    name: string;

    @AllowNull(true)
    @Column
    description: string;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @HasMany(() => KnowledgeSource)
    sources: KnowledgeSource[];

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default KnowledgeBase;
