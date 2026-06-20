/**
 * Shared TypeScript interfaces for Chameleon entities.
 * Used by schemas, bot commands, API routes, and frontend.
 */

// ─── Media ────────────────────────────────────────────────────

export interface MediaSchema {
    r2Key?: string;
    bucket: 'app' | 'discord';
    url: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    uploadedAt?: Date;
}

// ─── Name Field ───────────────────────────────────────────────

export interface NameField {
    indexable?: string;
    display?: string;
    closedNameDisplay?: string;
    aliases?: string[];
}

// ─── Discord Settings ─────────────────────────────────────────

export interface DiscordServerSettings {
    id: string;
    name?: string;
    description?: string;
    avatar?: MediaSchema;
    banner?: MediaSchema;
    proxyAvatar?: MediaSchema;
    pronounSeparator?: string;
}

export interface DiscordMetadata {
    messageCount?: number;
    lastMessageTime?: Date;
}

export interface EntityDiscordSettings {
    name?: { display?: string; openCharDisplay?: string };
    description?: string;
    color?: string;
    image?: {
        avatar?: MediaSchema;
        banner?: MediaSchema;
        proxyAvatar?: MediaSchema;
    };
    pronounSeparator?: string;
    server?: DiscordServerSettings[];
    metadata?: DiscordMetadata;
}

// ─── Mask Settings ────────────────────────────────────────────

export interface MaskDiscordSettings {
    name?: { display?: string; openCharDisplay?: string };
    description?: string;
    color?: string;
    image?: {
        avatar?: MediaSchema;
        banner?: MediaSchema;
        proxyAvatar?: MediaSchema;
    };
    pronounSeparator?: string;
}

export interface MaskSettings {
    name?: NameField;
    description?: string;
    color?: string;
    avatar?: MediaSchema;
    discord?: MaskDiscordSettings;
}

// ─── Caution/Trigger ──────────────────────────────────────────

export interface TriggerSchema {
    [key: string]: any; // Trigger schema details
}

export interface CautionSettings {
    c_type?: string;
    detail?: string;
    triggers?: TriggerSchema[];
}

// ─── Connected State (Alter-specific) ─────────────────────────

export interface AlterConnectedState {
    connected_id?: string;
    name?: NameField;
    avatar?: MediaSchema;
    description?: string;
    caution?: CautionSettings;
}

// ─── Entity Metadata ──────────────────────────────────────────

export interface EntityMetadata {
    addedAt?: Date;
    convertedFrom?: string;
    convertedAt?: Date;
    originalId?: string;
    importedFrom?: string;
    pluralKitId?: string;
    pluralKitUuid?: string;
}

// ─── Privacy Settings ─────────────────────────────────────────

export interface PrivacyEntry {
    bucket: string;
    settings: Record<string, any>;
}

export interface MaskTarget {
    userFriendID?: string;
    discordUserID?: string;
    discordGuildID?: string;
}

export interface EntitySettings {
    allowPing?: boolean;
    default_status?: string;
    default_battery?: number;
    mask?: {
        maskTo?: MaskTarget[];
        maskExclude?: MaskTarget[];
    };
    privacy?: PrivacyEntry[];
}

// ─── Base Entity (shared across Alter/State/Group) ────────────

export interface BaseEntity {
    _id: any; // MongoDB ObjectId
    id: string; // Snowflake ID
    systemID?: string;
    syncWithApps?: { discord?: boolean };
    name?: NameField;
    description?: string;
    color?: string;
    avatar?: MediaSchema;
    signoff?: string;
    mask?: MaskSettings;
    discord?: EntityDiscordSettings;
    caution?: CautionSettings;
    condition?: string;
    proxy?: string[];
    metadata?: EntityMetadata;
    setting?: EntitySettings;
}

// ─── Alter ────────────────────────────────────────────────────

export interface Alter extends BaseEntity {
    genesisDate?: Date;
    pronouns?: string[];
    states?: AlterConnectedState[];
    groupsIDs?: string[];
    activeStates?: {
        priority?: string;
        all?: string[];
    };
}

// ─── State ────────────────────────────────────────────────────

export interface State extends BaseEntity {
    genesisDate?: Date;
    alters?: string[];
    groupIDs?: string[];
}

// ─── Group ────────────────────────────────────────────────────

export interface Group extends BaseEntity {
    createdAt?: Date;
    type?: {
        name?: string;
        canFront?: 'yes' | 'no';
    };
    alterIDs?: string[];
    stateIDs?: string[];
}

// ─── System ───────────────────────────────────────────────────

export interface SystemType {
    name?: string;
    dd?: {
        DSM?: string;
        ICD?: string;
    };
    isSystem?: boolean;
    isFragmented?: boolean;
    isDissociative?: boolean;
    dissociativeStateName?: string;
    onboardingCompleted?: boolean;
}

export interface SystemTheme {
    background?: {
        media?: MediaSchema;
        colorTheme?: { colors?: string[] };
    };
}

export interface SystemMetadata {
    joinedAt?: Date;
    importBackups?: any[];
}

export interface System {
    _id: any;
    id: string;
    users?: any[];
    metadata?: SystemMetadata;
    syncWithApps?: { discord?: boolean };
    name?: NameField;
    sys_type?: SystemType;
    description?: string;
    birthday?: Date;
    timezone?: string;
    color?: string;
    theme?: SystemTheme;
    alters?: { IDs?: string[] };
    states?: { IDs?: string[] };
    groups?: { IDs?: string[] };
    setting?: EntitySettings;
}

// ─── Note ─────────────────────────────────────────────────────

export interface Note {
    _id: any;
    id: string;
    author?: {
        userID?: any;
        subs?: { ID?: string }[];
    };
    title?: string;
    content?: string;
    tags?: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

// ─── User ─────────────────────────────────────────────────────

export interface User {
    _id: any;
    id: string;
    discordID?: string;
    username?: string;
    email?: string;
    createdAt?: Date;
}
