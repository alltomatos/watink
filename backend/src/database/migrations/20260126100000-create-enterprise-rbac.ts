import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Roles
        await queryInterface.createTable("Roles", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            description: {
                type: DataTypes.STRING,
                allowNull: true
            },
            isSystem: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false
            },
            tenantId: {
                type: DataTypes.UUID,
                references: { model: "Tenants", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        // Unique constraint: name + tenantId
        await queryInterface.addIndex("Roles", ["name", "tenantId"], {
            unique: true,
            name: "roles_name_tenant_unique"
        });

        // 2. Permissions (Recriando ou Alterando se já existir, mas no clean deploy assumimos controle)
        // No fluxo clean, as tabelas antigas podem ter sido criadas por migrações anteriores se não editarmos elas. 
        // Como vamos editar as antigas para serem "noop", aqui criamos a estrutura correta.

        // Verificamos se Permissions já existe (caso migrações antigas rodem) e alteramos, ou criamos.
        const tableInfo = await queryInterface.describeTable("Permissions").catch(() => null);

        if (!tableInfo) {
            await queryInterface.createTable("Permissions", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false
                },
                resource: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                action: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                description: {
                    type: DataTypes.STRING,
                    allowNull: true
                },
                isSystem: {
                    type: DataTypes.BOOLEAN,
                    defaultValue: true
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                }
            });
        } else {
            // Se já existe (legado), vamos migrar a estrutura
            // Remover coluna name, adicionar resource e action
            // Mas como é clean deploy, preferimos dropar e recriar para garantir integridade
            await queryInterface.dropTable("Permissions");
            await queryInterface.createTable("Permissions", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false
                },
                resource: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                action: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                description: {
                    type: DataTypes.STRING,
                    allowNull: true
                },
                isSystem: {
                    type: DataTypes.BOOLEAN,
                    defaultValue: true
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                }
            });
        }

        // Unique constraint permission
        await queryInterface.addIndex("Permissions", ["resource", "action"], {
            unique: true,
            name: "permissions_resource_action_unique"
        });

        // 3. RolePermissions
        await queryInterface.createTable("RolePermissions", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            roleId: {
                type: DataTypes.INTEGER,
                references: { model: "Roles", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            permissionId: {
                type: DataTypes.INTEGER,
                references: { model: "Permissions", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            scope: {
                type: DataTypes.JSONB,
                allowNull: true,
                comment: 'Restrictions like { "queueIds": [1,2], "onlyOwn": true }'
            },
            conditions: {
                type: DataTypes.JSONB,
                allowNull: true,
                comment: 'ABAC conditions like time of day'
            },
            tenantId: {
                type: DataTypes.UUID,
                references: { model: "Tenants", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        // 4. UserRoles
        await queryInterface.createTable("UserRoles", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            userId: {
                type: DataTypes.INTEGER,
                references: { model: "Users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            roleId: {
                type: DataTypes.INTEGER,
                references: { model: "Roles", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            tenantId: {
                type: DataTypes.UUID,
                references: { model: "Tenants", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        await queryInterface.addIndex("UserRoles", ["userId", "roleId"], {
            unique: true,
            name: "user_roles_unique"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("UserRoles");
        await queryInterface.dropTable("RolePermissions");
        await queryInterface.dropTable("Permissions"); // Atenção aqui no rollback
        await queryInterface.dropTable("Roles");
    }
};
