
import sequelize from "../database";
import User from "../models/User";
import Queue from "../models/Queue";
import Role from "../models/Role";
import Group from "../models/Group";

const run = async () => {
  try {
    console.log("Connecting to database...");
    // Just finding the user will trigger connection logic inside Sequelize instance if configured correctly
    
    const user = await User.findOne({
      where: { email: "ronaldodavi@gmail.com" },
      include: [
        { model: Queue, as: "queues" },
        { model: Role, as: "roles" },
        { model: Group, as: "groups" }
      ]
    });

    if (!user) {
      console.log("User 'ronaldodavi@gmail.com' not found");
    } else {
      const isAdmin = user.roles?.some(role => role.name === "Admin") || user.email === "admin@admin.com";
      const profile = isAdmin ? "admin" : "user";

      // Collect permissions from groups and roles
      const groupPermissions = user.groups?.flatMap(g => g.permissions || []) || [];
      const rolePermissions = user.roles?.flatMap(r => r.permissions || []) || [];
      const allPermissions = [...groupPermissions, ...rolePermissions];

      console.log("---------------------------------------------------");
      console.log(`User: ${user.email} (ID: ${user.id})`);
      console.log(`TenantId: ${user.tenantId}`);
      console.log(`Roles: ${user.roles?.map(r => r.name).join(", ") || "None"}`);
      console.log(`Groups: ${user.groups?.map(g => g.name).join(", ") || "None"}`);
      console.log(`Derived Profile: ${profile}`);
      console.log(`Queues Assigned: ${user.queues?.map(q => `${q.id}:${q.name}`).join(", ") || "None"}`);
      console.log(`Total Permissions: ${allPermissions.length}`);
      console.log(`Permissions: ${allPermissions.map(p => `${p.resource}:${p.action}`).join(", ")}`);
      console.log("---------------------------------------------------");

      const queues = await Queue.findAll({ where: { tenantId: user.tenantId } });
      console.log("All Available Queues in Tenant:");
      queues.forEach(q => console.log(` - [${q.id}] ${q.name}`));

    }

  } catch (err) {
    console.error("Error executing script:", err);
  } finally {
    await sequelize.close();
  }
};

run();
