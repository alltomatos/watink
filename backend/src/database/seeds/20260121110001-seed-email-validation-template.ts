import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Find ALL Tenants
        let tenants: any[] = [];
        try {
            tenants = await queryInterface.sequelize.query('SELECT id FROM "Tenants"', { type: "SELECT" as any }) as any[];
        } catch (e) { }

        if (tenants.length === 0) {
            const raw = await queryInterface.sequelize.query('SELECT id FROM "Tenants"');
            if (raw[0] && (raw[0] as any[]).length > 0) tenants = raw[0] as any[];
        }

        if (tenants.length === 0) {
            console.warn("Skipping Email Validation Template seed: No tenants found.");
            return;
        }

        const templatesToInsert = [];

        const subject = "Confirme seu e-mail - {{companyName}}";
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
    .content { padding: 40px; color: #333; line-height: 1.6; }
    .footer { background: #333; color: #aaa; text-align: center; padding: 20px; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #764ba2; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold; }
    strong { color: #555; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Confirme seu E-mail 📧</h1>
    </div>
    <div class="content">
      <p>Olá, <strong>{{name}}</strong>!</p>
      <p>Para confirmar seu endereço de e-mail e ativar completamente sua conta no <strong>{{companyName}}</strong>, clique no botão abaixo:</p>
      
      <div style="text-align: center;">
        <a href="{{verificationUrl}}" class="button">Confirmar E-mail</a>
      </div>

      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Se você não solicitou este e-mail, pode ignorá-lo com segurança.
      </p>
    </div>
    <div class="footer">
      &copy; {{year}} {{companyName}}. Todos os direitos reservados.
    </div>
  </div>
</body>
</html>
    `;
        const text = `
Confirme seu E-mail - {{companyName}}

Olá, {{name}}!
Para confirmar seu endereço de e-mail, acesse o link abaixo:

{{verificationUrl}}

Se você não solicitou este e-mail, pode ignorá-lo.
    `;

        for (const tenant of tenants) {
            const tenantId = tenant.id;
            const existing = await queryInterface.sequelize.query(
                `SELECT * FROM "EmailTemplates" WHERE name = 'email_validation' AND "tenantId" = '${tenantId}'`
            );

            if ((existing[0] as any[]).length === 0) {
                templatesToInsert.push({
                    name: "email_validation",
                    subject: subject,
                    html: html,
                    text: text,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    tenantId: tenantId
                });
            }
        }

        if (templatesToInsert.length > 0) {
            return queryInterface.bulkInsert("EmailTemplates", templatesToInsert, {});
        }
    },

    down: (queryInterface: QueryInterface) => {
        return queryInterface.bulkDelete("EmailTemplates", { name: "email_validation" });
    }
};
