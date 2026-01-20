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
    HasMany,
    DataType,
    Default,
} from "sequelize-typescript";
import Tenant from "./Tenant";
import ClientContact from "./ClientContact";
import ClientAddress from "./ClientAddress";

@Table({ tableName: "Clients" })
class Client extends Model<Client> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @Default("pf")
    @Column(DataType.STRING(10))
    type: string; // pf = pessoa física, pj = pessoa jurídica

    @Column(DataType.STRING(255))
    name: string;

    @Column(DataType.STRING(20))
    document: string; // CPF ou CNPJ

    @Column(DataType.STRING(255))
    email: string;

    @Column(DataType.STRING(20))
    phone: string;

    @Column(DataType.TEXT)
    notes: string;

    @Default(true)
    @Column
    isActive: boolean;

    @HasMany(() => ClientContact)
    contacts: ClientContact[];

    @HasMany(() => ClientAddress)
    addresses: ClientAddress[];

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default Client;
