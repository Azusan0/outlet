'use server';

import { HttpTypes } from '@medusajs/types';

import medusaError from '@/lib/helpers/medusa-error';

import { sdk } from '../client';
import { getCacheOptions } from './cookies';
import { getTenant } from '../tenant';

export const listRegions = async () => {
  const next = {
    ...(await getCacheOptions('regions')),
    revalidate: 3600,
  };

  return sdk.store.regions
    .query({ fetchOptions: { next, cache: 'force-cache' } })
    .then(({ regions }) => regions)
    .catch(medusaError);
};

export const retrieveRegion = async (id: string) => {
  const next = {
    ...(await getCacheOptions(['regions', id].join('-'))),
    revalidate: 3600,
  };

  return sdk.store.regions.$id
    .query({ $id: id, fetchOptions: { next, cache: 'force-cache' } })
    .then(({ region }) => region)
    .catch(medusaError);
};

const regionMap = new Map<string, HttpTypes.StoreRegion>();

export const getRegion = async (countryCode: string) => {
  try {
    const tenant = await getTenant();
    const cacheKey = `${tenant.slug}:${countryCode}`;
    if (regionMap.has(cacheKey)) return regionMap.get(cacheKey);

    const regions = await listRegions();

    if (!regions) {
      return null;
    }
    const tenantRegion = regions.find(region => region.id === tenant.region_id);
    if (tenantRegion) return tenantRegion;

    regions.forEach(region => {
      region.countries?.forEach(c => {
        regionMap.set(`${tenant.slug}:${c?.iso_2 ?? ''}`, region);
      });
    });

    return regionMap.get(cacheKey) ?? regions[0] ?? null;
  } catch (e) {
    return null;
  }
};
