/**
 * Alter schema — represents a single alter in the system.
 */

import mongoose, { Schema } from 'mongoose';
import sysDB from '../database';
import { alterPrivacySchema } from './settings';
import { createEntitySchema, applyEntityDefaults, alterConnectedStateSchema } from './entityBase';

// Entity-specific fields for Alter
const alterFields = {
    genesisDate: Date,
    pronouns: [String],
    states: [alterConnectedStateSchema],
    groupsIDs: [String],
    activeStates: {
        priority: String,
        all: [String],
    },
};

// Create the entity schema with shared base + alter-specific fields
const alterSchema = createEntitySchema(alterFields, alterPrivacySchema);

// Apply standard indexes and Redis hook
applyEntityDefaults(alterSchema, 'alter');

// Create the model (using `any` for gradual migration)
const Alter: any = sysDB.model('Alter', alterSchema);

export default Alter;

// CommonJS compatibility
module.exports = Alter;
