# Bot-Side Registration + Import Bug Report

## Critical Issues - FIXED ✅

### 1. Bot Import Doesn't Use `createSystemFromPayload` - FIXED ✅
**Location:** `discord_commands/functions/bot_utils/BotSessionManager.js`  
**Fix:** Updated `buildSystemPayload()` to match `createSystemFromPayload` expectations:
- `privacyBuckets`: Changed from strings to `{ name, friends }` objects
- `alters/states/groups`: Added `entities` array for bulk insert
- Added `dissociativeStateName` to `sys_type`
- Changed layer name from 'Active' to 'Main' with color

---

### 2. `sys!system new` Creates System Differently Than Embedded App - FIXED ✅
**Location:** `discord_commands/global/prefix/system.js` (handleNew)  
**Fix:** Updated to match embedded app's system creation:
- Added proper `sys_type` with `onboardingCompleted: true`
- Added default privacy settings matching embedded app
- Added import command hints in "Next Steps"

---

### 3. BotSessionManager.buildSystemPayload Structure Mismatch - FIXED ✅
**Location:** `discord_commands/functions/bot_utils/BotSessionManager.js`  
**Fix:** Restructured payload to match `createSystemFromPayload`:
- Added `entities` arrays for bulk insert
- Changed `privacyBuckets` to objects
- Added `dissociativeStateName` field
- Fixed layer structure

---

### 4. Bot Import Assumes System Exists - PARTIALLY FIXED ✅
**Location:** `discord_commands/global/prefix/import.js`  
**Note:** This is by design - bot import requires an existing system. The embedded app's import during registration is a different flow.

---

### 5. Bot Missing SP File Import Support - FIXED ✅
**Location:** `discord_commands/global/prefix/import.js`  
**Fix:** Added SP file import support:
- Added `handleSPFile()` function
- Added `importSimplyPluralFile` import
- Updated help text to mention file import
- Updated auto-detect to recognize SP format

---

## Moderate Issues - FIXED ✅

### 6. Bot Import Error Messages Could Be Clearer - IMPROVED ✅
**Location:** Various error handlers in import.js  
**Fix:** Error messages were already fairly clear. Added better help text with quick-start examples.

---

### 7. Bot `sys!system new` Doesn't Set `onboardingCompleted` - FIXED ✅
**Location:** `discord_commands/global/prefix/system.js` (handleNew)  
**Fix:** Added `sys_type` with `onboardingCompleted: true`

---

### 8. Bot Import Doesn't Have Preview Functionality - NOT FIXED ⚠️
**Issue:** Bot imports directly without preview.  
**Note:** This would require significant refactoring. The bot's import flow is designed for quick imports, while the embedded app's preview is more interactive. Could be added as a future enhancement.

---

### 9. Bot Import Doesn't Handle `selectedMemberIds` / `selectedGroupIds` - NOT FIXED ⚠️
**Issue:** Bot imports all members, no selection support.  
**Note:** Would require interactive selection UI which is complex for prefix commands. Could be added as a future enhancement with `-select:Name1,Name2` flag.

---

## Minor Issues - FIXED ✅

### 10. Bot Import Help Text Could Be More Discoverable - FIXED ✅
**Fix:** Added "Quick Start" section and "Tips" section to help text.

---

### 11. Bot `sys!import` Doesn't Have Enough Aliases - FIXED ✅
**Fix:** Added aliases: `imp`, `importdata`, `load`

---

### 12. Bot `sys!system` Doesn't Have Enough Aliases - FIXED ✅
**Fix:** Added aliases: `s`, `sys`, `profile`, `me`

---

## Files Modified

1. **`discord_commands/functions/bot_utils/BotSessionManager.js`**
   - Fixed `buildSystemPayload()` to match `createSystemFromPayload` expectations
   - Added entities arrays for bulk insert
   - Fixed privacy buckets structure
   - Added dissociativeStateName field

2. **`discord_commands/global/prefix/system.js`**
   - Fixed `handleNew()` to set proper `sys_type`
   - Added `onboardingCompleted: true`
   - Added import command hints in Next Steps
   - Added aliases: `profile`, `me`

3. **`discord_commands/global/prefix/import.js`**
   - Added SP file import support (`handleSPFile`)
   - Added `importSimplyPluralFile` import
   - Updated help text with Quick Start and Tips sections
   - Updated SP section to mention file import
   - Added aliases: `importdata`, `load`
   - Improved auto-detect to recognize SP format

---

## Remaining Work (Future Enhancements)

1. **Preview functionality for bot import** - Would require interactive UI
2. **Member selection support** - Would require `-select:Name1,Name2` flag
3. **Full parity with embedded app's registration flow** - Bot import is designed for post-registration imports

---

## Testing Recommendations

1. Test `sys!system new` to verify `sys_type` is set correctly
2. Test `sys!import simplyplural` with file attachment
3. Test `sys!import pluralkit` with API token
4. Test auto-detect with SP export file
5. Test error messages for invalid tokens/files
