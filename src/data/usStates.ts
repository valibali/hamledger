/**
 * US States data for WAS (Worked All States) tracking
 * Maps US call areas and state abbreviations to state names
 */

export interface USState {
  code: string;       // Two-letter state code
  name: string;       // Full state name
  callAreas: number[]; // US call areas (0-9) where this state is located
}

// All 50 US states for WAS award
export const US_STATES: USState[] = [
  { code: 'AL', name: 'Alabama', callAreas: [4] },
  { code: 'AK', name: 'Alaska', callAreas: [7] }, // Note: KL7 is separate DXCC
  { code: 'AZ', name: 'Arizona', callAreas: [7] },
  { code: 'AR', name: 'Arkansas', callAreas: [5] },
  { code: 'CA', name: 'California', callAreas: [6] },
  { code: 'CO', name: 'Colorado', callAreas: [0] },
  { code: 'CT', name: 'Connecticut', callAreas: [1] },
  { code: 'DE', name: 'Delaware', callAreas: [3] },
  { code: 'FL', name: 'Florida', callAreas: [4] },
  { code: 'GA', name: 'Georgia', callAreas: [4] },
  { code: 'HI', name: 'Hawaii', callAreas: [6] }, // Note: KH6 is separate DXCC
  { code: 'ID', name: 'Idaho', callAreas: [7] },
  { code: 'IL', name: 'Illinois', callAreas: [9] },
  { code: 'IN', name: 'Indiana', callAreas: [9] },
  { code: 'IA', name: 'Iowa', callAreas: [0] },
  { code: 'KS', name: 'Kansas', callAreas: [0] },
  { code: 'KY', name: 'Kentucky', callAreas: [4] },
  { code: 'LA', name: 'Louisiana', callAreas: [5] },
  { code: 'ME', name: 'Maine', callAreas: [1] },
  { code: 'MD', name: 'Maryland', callAreas: [3] },
  { code: 'MA', name: 'Massachusetts', callAreas: [1] },
  { code: 'MI', name: 'Michigan', callAreas: [8] },
  { code: 'MN', name: 'Minnesota', callAreas: [0] },
  { code: 'MS', name: 'Mississippi', callAreas: [5] },
  { code: 'MO', name: 'Missouri', callAreas: [0] },
  { code: 'MT', name: 'Montana', callAreas: [7] },
  { code: 'NE', name: 'Nebraska', callAreas: [0] },
  { code: 'NV', name: 'Nevada', callAreas: [7] },
  { code: 'NH', name: 'New Hampshire', callAreas: [1] },
  { code: 'NJ', name: 'New Jersey', callAreas: [2] },
  { code: 'NM', name: 'New Mexico', callAreas: [5] },
  { code: 'NY', name: 'New York', callAreas: [2] },
  { code: 'NC', name: 'North Carolina', callAreas: [4] },
  { code: 'ND', name: 'North Dakota', callAreas: [0] },
  { code: 'OH', name: 'Ohio', callAreas: [8] },
  { code: 'OK', name: 'Oklahoma', callAreas: [5] },
  { code: 'OR', name: 'Oregon', callAreas: [7] },
  { code: 'PA', name: 'Pennsylvania', callAreas: [3] },
  { code: 'RI', name: 'Rhode Island', callAreas: [1] },
  { code: 'SC', name: 'South Carolina', callAreas: [4] },
  { code: 'SD', name: 'South Dakota', callAreas: [0] },
  { code: 'TN', name: 'Tennessee', callAreas: [4] },
  { code: 'TX', name: 'Texas', callAreas: [5] },
  { code: 'UT', name: 'Utah', callAreas: [7] },
  { code: 'VT', name: 'Vermont', callAreas: [1] },
  { code: 'VA', name: 'Virginia', callAreas: [4] },
  { code: 'WA', name: 'Washington', callAreas: [7] },
  { code: 'WV', name: 'West Virginia', callAreas: [8] },
  { code: 'WI', name: 'Wisconsin', callAreas: [9] },
  { code: 'WY', name: 'Wyoming', callAreas: [7] },
];

// Total number of states for WAS
export const WAS_TOTAL_STATES = 50;

// State code to name map
const stateCodeMap = new Map<string, USState>();
for (const state of US_STATES) {
  stateCodeMap.set(state.code, state);
}

/**
 * Get state by code
 */
export function getStateByCode(code: string): USState | null {
  return stateCodeMap.get(code.toUpperCase()) || null;
}

/**
 * Get all state codes
 */
export function getAllStateCodes(): string[] {
  return US_STATES.map(s => s.code);
}

/**
 * Get states in a call area
 */
export function getStatesByCallArea(callArea: number): USState[] {
  return US_STATES.filter(s => s.callAreas.includes(callArea));
}

/**
 * Check if a state code is valid
 */
export function isValidStateCode(code: string): boolean {
  return stateCodeMap.has(code.toUpperCase());
}
