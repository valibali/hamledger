/**
 * DXCC Entity Parser and Lookup
 * Based on the ARRL DXCC entity list
 */

import dxccCurrentDeleted from '../data/dxcc_current_deleted_2022.json';
import arrlPrefixesRaw from '../data/arrlpre3.txt?raw';

export interface DXCCEntity {
  entityCode: number;      // DXCC entity number
  name: string;            // Entity name
  cqZone: number;          // CQ zone (1-40)
  ituZone: number;         // ITU zone (1-90)
  continent: string;       // AF, AN, AS, EU, NA, OC, SA
  latitude: number;
  longitude: number;
  timeOffset: number;      // UTC offset
  primaryPrefix: string;   // Primary prefix
  prefixes: string[];      // All valid prefixes (regex patterns)
  deleted?: boolean;       // Deleted entity
}

type DxccSourceEntity = {
  prefix: string;
  entity: string;
  continent: string;
  zoneITU: string;
  zoneCQ: string;
  entityCode: number;
  isCurrent: boolean;
};

type ArrlEntityDetails = {
  continent: string;
  latitude: number;
  longitude: number;
  ituZone: number;
  cqZone: number;
  primaryPrefix: string;
  prefixes: string[];
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  values.push(current);
  return values;
}

function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(st)\b/g, 'saint')
    .replace(/[^a-z0-9]/g, '');
}

function parseDxccSourceEntities(): DxccSourceEntity[] {
  const entities = (dxccCurrentDeleted as { entities?: DxccSourceEntity[] }).entities;
  return Array.isArray(entities) ? entities : [];
}

function parseArrlPrefixes(raw: string): Map<string, ArrlEntityDetails> {
  const details = new Map<string, ArrlEntityDetails>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = parseCsvLine(trimmed);
    if (parts.length < 8) continue;
    const prefix = parts[0]?.trim();
    const name = parts[1]?.trim();
    if (!prefix || !name) continue;

    const continent = parts[2]?.trim() || '??';
    const rawLongitude = Number(parts[3]);
    const latitude = Number(parts[4]);
    const primaryFlag = parts[5]?.trim() === '*';
    const ituZone = Number.parseInt(parts[6] ?? '', 10);
    const cqZone = Number.parseInt(parts[7] ?? '', 10);

    const longitude = Number.isFinite(rawLongitude) ? rawLongitude : 0;
    const normalized = normalizeEntityName(name);

    const existing = details.get(normalized);
    if (!existing) {
      details.set(normalized, {
        continent,
        latitude: Number.isFinite(latitude) ? latitude : 0,
        longitude,
        ituZone: Number.isFinite(ituZone) ? ituZone : 0,
        cqZone: Number.isFinite(cqZone) ? cqZone : 0,
        primaryPrefix: primaryFlag ? prefix : '',
        prefixes: [prefix],
      });
      continue;
    }

    if (!existing.prefixes.includes(prefix)) {
      existing.prefixes.push(prefix);
    }
    if (primaryFlag && !existing.primaryPrefix) {
      existing.primaryPrefix = prefix;
    }
  }

  return details;
}

function parseSourcePrefixes(prefixRaw: string): string[] {
  if (!prefixRaw) return [];
  return prefixRaw.split(',').map((p) => p.trim()).filter(Boolean);
}

function buildDxccEntities(): DXCCEntity[] {
  const sourceEntities = parseDxccSourceEntities();
  const arrlDetails = parseArrlPrefixes(arrlPrefixesRaw);

  return sourceEntities.map((entity) => {
    const details = arrlDetails.get(normalizeEntityName(entity.entity));
    const fallbackPrefixes = parseSourcePrefixes(entity.prefix);
    const prefixes = details?.prefixes ?? fallbackPrefixes;
    const longitude = details?.longitude ?? 0;
    return {
      entityCode: entity.entityCode,
      name: entity.entity,
      cqZone: details?.cqZone ?? (Number.parseInt(entity.zoneCQ, 10) || 0),
      ituZone: details?.ituZone ?? (Number.parseInt(entity.zoneITU, 10) || 0),
      continent: details?.continent ?? entity.continent ?? '??',
      latitude: details?.latitude ?? 0,
      longitude,
      timeOffset: Number.isFinite(longitude) ? Math.round(longitude / 15) : 0,
      primaryPrefix: details?.primaryPrefix || prefixes[0] || '',
      prefixes,
      deleted: !entity.isCurrent,
    };
  });
}

const DXCC_ENTITIES: DXCCEntity[] = buildDxccEntities();

// Build lookup maps for fast access
let prefixToEntityMap: Map<string, DXCCEntity> | null = null;
let entityCodeMap: Map<number, DXCCEntity> | null = null;

function buildMaps(): void {
  if (prefixToEntityMap !== null) return;
  
  prefixToEntityMap = new Map();
  entityCodeMap = new Map();
  
  for (const entity of DXCC_ENTITIES) {
    entityCodeMap.set(entity.entityCode, entity);
    
    // Add all prefixes
    for (const prefix of entity.prefixes) {
      prefixToEntityMap.set(prefix.toUpperCase(), entity);
    }
  }
}

/**
 * Look up DXCC entity from callsign
 * Uses longest prefix match
 */
export function lookupCallsign(callsign: string): DXCCEntity | null {
  buildMaps();
  if (!prefixToEntityMap) return null;
  
  const call = callsign.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!call) return null;
  
  // Extract base callsign (remove portable suffixes like /P, /M, /MM)
  const baseParts = call.split('/');
  let baseCall = baseParts[0];
  
  // Handle prefix/call format (e.g., DL/HA5XB)
  if (baseParts.length > 1) {
    // If first part looks like a prefix (short), use it
    if (baseParts[0].length <= 4 && /^[A-Z0-9]+$/.test(baseParts[0])) {
      // Use the prefix for lookup
      baseCall = baseParts[0];
    } else {
      baseCall = baseParts.find(p => p.length > 3) || baseParts[0];
    }
  }
  
  // Try progressively shorter prefixes (longest match first)
  for (let len = Math.min(baseCall.length, 6); len >= 1; len--) {
    const prefix = baseCall.substring(0, len);
    const entity = prefixToEntityMap.get(prefix);
    if (entity) {
      return entity;
    }
  }
  
  return null;
}

/**
 * Get DXCC entity by entity code
 */
export function getEntityByCode(code: number): DXCCEntity | null {
  buildMaps();
  return entityCodeMap?.get(code) || null;
}

/**
 * Get all DXCC entities
 */
export function getAllEntities(): DXCCEntity[] {
  return [...DXCC_ENTITIES];
}

/**
 * Get the number of current (non-deleted) DXCC entities
 */
export function getCurrentEntityCount(): number {
  return DXCC_ENTITIES.filter(e => !e.deleted).length;
}

/**
 * Get all CQ zones (1-40)
 */
export function getAllCQZones(): number[] {
  return Array.from({ length: 40 }, (_, i) => i + 1);
}

/**
 * Get all ITU zones (1-90)
 */
export function getAllITUZones(): number[] {
  return Array.from({ length: 90 }, (_, i) => i + 1);
}

/**
 * Get entities by continent
 */
export function getEntitiesByContinent(continent: string): DXCCEntity[] {
  return DXCC_ENTITIES.filter(e => e.continent === continent.toUpperCase());
}

/**
 * Get entities by CQ zone
 */
export function getEntitiesByCQZone(zone: number): DXCCEntity[] {
  return DXCC_ENTITIES.filter(e => e.cqZone === zone);
}

export { DXCC_ENTITIES };
