/**
 * State schema — represents a dissociative state.
 */

import mongoose, { Schema } from 'mongoose';
import sysDB from '../database';
import { alterPrivacySchema } from './settings';
import { createEntitySchema, applyEntityDefaults } from './entityBase';

// Entity-specific fields for State
const stateFields = {
    genesisDate: { type: Date, default: Date.now },
    alters: [String],
    groupIDs: [String],
};

// Create the entity schema with shared base + state-specific fields
const stateSchema = createEntitySchema(stateFields, alterPrivacySchema);

// Apply standard indexes and Redis hook
applyEntityDefaults(stateSchema, 'state');

// Create the model (using `any` for gradual migration)
const State: any = sysDB.model('State', stateSchema);

export default State;

// CommonJS compatibility
module.exports = State;
