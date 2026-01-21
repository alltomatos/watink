import Mustache from "mustache";

export const getPremiumWelcomeEmail = (
  name: string,
  email: string,
  password: string,
  companyName: string = "Watink",
  frontendUrl: string = process.env.FRONTEND_URL || "http://localhost:3000"
): { subject: string; html: string; text: string } => {
  const view = {
    name,
    email,
    password,
    companyName,
    frontendUrl,
    year: new Date().getFullYear()
  };

  const subject = "Bem-vindo ao {{companyName}} - Suas credenciais de acesso";

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
    .credentials { background: #f8f9fa; border-left: 4px solid #764ba2; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #333; color: #aaa; text-align: center; padding: 20px; font-size: 12px; }
    .button { display: inline-block; padding: 10px 20px; background-color: #764ba2; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    strong { color: #555; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bem-vindo! 🚀</h1>
    </div>
    <div class="content">
      <p>Olá, <strong>{{name}}</strong>!</p>
      <p>Estamos muito felizes em ter você conosco no <strong>{{companyName}}</strong>.</p>
      <p>Sua conta foi criada com sucesso. Abaixo estão suas credenciais para acessar a plataforma:</p>
      
      <div class="credentials">
        <p><strong>Login:</strong> {{email}}</p>
        <p><strong>Senha:</strong> {{password}}</p>
      </div>

      <p>Recomendamos que você altere sua senha após o primeiro acesso.</p>
      
      <div style="text-align: center;">
        <a href="{{frontendUrl}}" class="button">Acessar Plataforma</a>
      </div>
    </div>
    <div class="footer">
      &copy; {{year}} {{companyName}}. Todos os direitos reservados.
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Bem-vindo ao {{companyName}}!

Olá, {{name}}!
Sua conta foi criada com sucesso.

Login: {{email}}
Senha: {{password}}

Acesse a plataforma para começar: {{frontendUrl}}
  `;

  return {
    subject: Mustache.render(subject, view),
    html: Mustache.render(html, view),
    text: Mustache.render(text, view)
  };
};
