/**
 * Group schema — represents a group of alters/states.
 */

import mongoose, { Schema } from 'mongoose';
import sysDB from '../database';
import { groupPrivacySchema } from './settings';
import { createEntitySchema, applyEntityDefaults } from './entityBase';

// Entity-specific fields for Group
const groupFields = {
    createdAt: { type: Date, default: Date.now },
    type: {
        name: String,
        canFront: { type: String, enum: ['yes', 'no'], default: 'yes' },
    },
    alterIDs: [String],
    stateIDs: [String],
};

// Create the entity schema with shared base + group-specific fields
const groupSchema = createEntitySchema(groupFields, groupPrivacySchema);

// Apply standard indexes and Redis hook
applyEntityDefaults(groupSchema, 'group');

// Create the model (using `any` for gradual migration)
const Group: any = sysDB.model('Group', groupSchema);

export default Group;

// CommonJS compatibility
module.exports = Group;
