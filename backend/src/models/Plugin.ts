
import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    DataType,
    PrimaryKey,
    Default
} from "sequelize-typescript";

@Table({
    tableName: "Plugins"
})
class Plugin extends Model<Plugin> {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string;

    @Column
    slug: string;

    @Column
    name: string;

    @Column(DataType.TEXT)
    description: string;

    @Column
    version: string;

    @Column
    type: string;

    @Column(DataType.DECIMAL(10, 2))
    price: number;

    @Column
    iconUrl: string;

    @Column
    downloadUrl: string;

    @Column
    category: string;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default Plugin;
