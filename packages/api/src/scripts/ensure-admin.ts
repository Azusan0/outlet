import type { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

type UserRecord = { id: string; email: string };
type AuthIdentityRecord = {
  id: string;
  app_metadata?: Record<string, unknown> | null;
};

export default async function ensureDemoAdmin({ container }: ExecArgs) {
  const email = process.env.DEMO_ADMIN_EMAIL?.trim();
  const password = process.env.DEMO_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD must be set before provisioning the demo admin.",
    );
  }

  const userService = container.resolve(Modules.USER) as {
    listUsers(filters: { email: string }): Promise<UserRecord[]>;
    createUsers(input: { email: string }): Promise<UserRecord>;
  };
  const authService = container.resolve(Modules.AUTH) as {
    register(
      provider: string,
      input: { body: { email: string; password: string } },
    ): Promise<{
      success: boolean;
      error?: string;
      authIdentity?: AuthIdentityRecord;
    }>;
    updateProvider(
      provider: string,
      input: { entity_id: string; password: string },
    ): Promise<{
      success: boolean;
      error?: string;
      authIdentity?: AuthIdentityRecord;
    }>;
    authenticate(
      provider: string,
      input: { body: { email: string; password: string } },
    ): Promise<{ success: boolean; error?: string }>;
    updateAuthIdentities(input: {
      id: string;
      app_metadata: Record<string, unknown>;
    }): Promise<AuthIdentityRecord>;
  };

  let [user] = await userService.listUsers({ email });
  if (!user) {
    user = await userService.createUsers({ email });
  }

  let authResult = await authService.register("emailpass", {
    body: { email, password },
  });
  if (!authResult.success) {
    authResult = await authService.updateProvider("emailpass", {
      entity_id: email,
      password,
    });
  }
  if (!authResult.success || !authResult.authIdentity) {
    throw new Error(authResult.error || "Unable to provision admin credentials");
  }

  await authService.updateAuthIdentities({
    id: authResult.authIdentity.id,
    app_metadata: {
      ...(authResult.authIdentity.app_metadata ?? {}),
      user_id: user.id,
    },
  });

  const verification = await authService.authenticate("emailpass", {
    body: { email, password },
  });
  if (!verification.success) {
    throw new Error(verification.error || "Admin credential verification failed");
  }

  console.log(`ADMIN_READY ${email}`);
}
