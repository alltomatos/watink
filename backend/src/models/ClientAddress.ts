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
} from "sequelize-typescript";
import Client from "./Client";

@Table({ tableName: "ClientAddresses" })
class ClientAddress extends Model<ClientAddress> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Client)
    @Column
    clientId: number;

    @BelongsTo(() => Client)
    client: Client;

    @Column(DataType.STRING(100))
    label: string; // ex: "Sede", "Filial", "Residência"

    @Column(DataType.STRING(10))
    zipCode: string;

    @Column(DataType.STRING(255))
    street: string;

    @Column(DataType.STRING(20))
    number: string;

    @Column(DataType.STRING(100))
    complement: string;

    @Column(DataType.STRING(100))
    neighborhood: string;

    @Column(DataType.STRING(100))
    city: string;

    @Column(DataType.STRING(2))
    state: string;

    @Default(false)
    @Column
    isPrimary: boolean;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default ClientAddress;
