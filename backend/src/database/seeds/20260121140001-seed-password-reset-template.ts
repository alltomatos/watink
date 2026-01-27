import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Get all tenantIds from the Tenants table
        const [tenants] = await queryInterface.sequelize.query(
            'SELECT id FROM "Tenants";'
        );

        const templates = tenants.map((tenant: any) => ({
            name: "password_reset",
            subject: "Redefinição de Senha - {{companyName}}",
            html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Redefinição de Senha</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Olá, {{name}}</h2>
                
                <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>{{companyName}}</strong>.</p>
                
                <p>Para criar uma nova senha, clique no botão abaixo:</p>
                
                <p style="text-align: center; margin: 30px 0;">
                    <a href="{{frontendUrl}}/reset-password/{{token}}" 
                       style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                        Redefinir Minha Senha
                    </a>
                </p>
                
                <p>Este link expira em 1 hora.</p>

                <p>Se você não solicitou esta alteração, pode ignorar este e-mail com segurança.</p>
                
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                
                <p style="font-size: 12px; color: #999;">
                    Este é um e-mail automático, por favor não responda.
                </p>
            </div>
        </body>
        </html>
      `,
            text: `
        Olá, {{name}}

        Recebemos uma solicitação para redefinir a senha da sua conta no {{companyName}}.

        Para criar uma nova senha, acesse o link abaixo:
        {{frontendUrl}}/reset-password/{{token}}

        Este link expira em 1 hora.

        Se você não solicitou esta alteração, pode ignorar este e-mail com segurança.
      `,
            tenantId: tenant.id,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        if (templates.length > 0) {
            // @ts-ignore
            await queryInterface.bulkInsert("EmailTemplates", templates, { ignoreDuplicates: true } as any);
        }
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.bulkDelete("EmailTemplates", { name: "password_reset" }, {});
    }
};
