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
    DataType
} from "sequelize-typescript";
import KnowledgeSource from "./KnowledgeSource";
import Tenant from "./Tenant";

@Table
class KnowledgeVector extends Model<KnowledgeVector> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => KnowledgeSource)
    @Column
    sourceId: number;

    @BelongsTo(() => KnowledgeSource)
    source: KnowledgeSource;

    @AllowNull(false)
    @Column(DataType.TEXT)
    content: string;

    @AllowNull(true)
    @Column(DataType.ARRAY(DataType.FLOAT))
    vector: number[];

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default KnowledgeVector;
