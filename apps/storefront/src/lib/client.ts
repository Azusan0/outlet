import 'server-only';

import { createClient, InferClient } from '@mercurjs/client';
import type { Routes } from '@outlet/api/_generated';
import { getTenant } from './tenant';
import { createTenantScopedClient } from './tenant-client.mjs';

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';

const baseClient: InferClient<Routes> = createClient({
  baseUrl: MEDUSA_BACKEND_URL,
});

export const sdk: InferClient<Routes> = createTenantScopedClient(baseClient, getTenant);
