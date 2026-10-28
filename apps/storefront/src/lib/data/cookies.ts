import 'server-only';
import { cookies as nextCookies } from 'next/headers';
import { getTenant } from '../tenant';
import { shouldSecureCookies } from '../cookie-security.mjs';
import { buildCacheTag } from '../request-cache.mjs';

const secureCookies = () => shouldSecureCookies(
  process.env.NEXT_PUBLIC_BASE_URL,
  process.env.NODE_ENV
);

export const getAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  const cookies = await nextCookies();
  const token = cookies.get('_medusa_jwt')?.value;

  if (!token) {
    return {};
  }

  return { authorization: `Bearer ${token}` };
};

export const getCacheTag = async (
  tag: string
): Promise<string> => {
  try {
    const cookies = await nextCookies();
    const cacheId = cookies.get('_medusa_cache_id')?.value;

    if (!cacheId) {
      return '';
    }

    const tenant = await getTenant();
    return buildCacheTag(tag, tenant.slug, cacheId);
  } catch (error) {
    return '';
  }
};

export const getCacheOptions = async (
  tag: string
): Promise<{ tags: string[] } | {}> => {
  if (typeof window !== 'undefined') {
    return {};
  }

  const cacheTag = await getCacheTag(tag);

  if (!cacheTag) {
    return {};
  }

  return { tags: [`${cacheTag}`] };
};

export const setAuthToken = async (token: string) => {
  const cookies = await nextCookies();
  cookies.set('_medusa_jwt', token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
  });
};

export const removeAuthToken = async () => {
  const cookies = await nextCookies();
  cookies.set('_medusa_jwt', '', {
    maxAge: -1,
    path: '/',
  });
};

export const getCartId = async () => {
  const cookies = await nextCookies();
  const tenant = await getTenant();
  return cookies.get(`_outlet_cart_${tenant.slug}`)?.value;
};

export const setCartId = async (cartId: string) => {
  const cookies = await nextCookies();
  const tenant = await getTenant();
  cookies.set(`_outlet_cart_${tenant.slug}`, cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: 'strict',
    secure: secureCookies(),
    path: '/',
  });
};

export const removeCartId = async () => {
  const cookies = await nextCookies();
  const tenant = await getTenant();
  cookies.set(`_outlet_cart_${tenant.slug}`, '', {
    maxAge: -1,
    path: '/',
  });
};
