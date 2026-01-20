
import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    DataType,
    PrimaryKey,
    Default,
    ForeignKey,
    BelongsTo
} from "sequelize-typescript";
import Tenant from "./Tenant";
import Plugin from "./Plugin";

@Table({
    tableName: "PluginInstallations"
})
class PluginInstallation extends Model<PluginInstallation> {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @ForeignKey(() => Plugin)
    @Column(DataType.UUID)
    pluginId: string;

    @BelongsTo(() => Plugin)
    plugin: Plugin;

    @Column
    installedVersion: string;

    @Default("inactive")
    @Column
    status: string;

    @Column
    licenseKey: string;

    @Column
    licenseValidUntil: Date;

    @Column
    installedAt: Date;

    @Column
    activatedAt: Date;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default PluginInstallation;
