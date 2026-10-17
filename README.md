# Routix Plugin — hello-world

A minimal example plugin for the [Routix](https://github.com/mezouar-oualid-abdelbar/Routix) activity management app.

## What a Routix plugin is

A Routix plugin is a small piece of JavaScript that runs inside Routix through an isolated WebView sandbox. Plugins can create, read, update, and delete activities through Routix's shared activity-management API, but they cannot write directly to Routix's database. All plugin activity operations go through Routix, which applies validation, scheduling-conflict checks, and notification scheduling.

## Project structure

```
Routix-plugin/
├── config.json    # Plugin metadata (id, name, version, description, main entry)
└── index.js       # Plugin entry point (runs in the WebView sandbox)
```

### `config.json`

| Field   | Required | Description                                              |
|---------|----------|----------------------------------------------------------|
| `id`    | Yes      | Stable plugin identifier. Used as the `app` source value for all activities this plugin creates. Must be unique across installed plugins. |
| `name`  | Yes      | Human-readable plugin name (displayed in the UI).        |
| `version` | Yes    | Plugin version string (semver recommended).             |
| `description` | No | Short description of what the plugin does.              |
| `main`  | Yes      | Entry point file relative to the plugin root (e.g. `"index.js"`). |

## How the plugin integrates with Routix

1. **Installation**: A user installs a plugin by providing a URL (e.g. a GitHub raw file) on the Plugins screen in Routix.
2. **Loading**: Routix fetches the plugin code and runs it in an invisible WebView sandbox via `react-native-webview`.
3. **Initialization**: The sandbox injects a `Plugin` global object. The plugin calls `Plugin.onLoad(handler)` to register its startup logic.
4. **Communication**: The plugin sends messages to Routix via `postMessage` (e.g. `Plugin.showText`, `Plugin.createActivity`). Routix sends responses back by injecting JavaScript into the WebView (e.g. `window.Plugin.onPluginResponse(...)`).
5. **Bridge readiness**: The sandbox waits for the native React Native WebView bridge to be available before running plugin code. Messages are queued until the bridge is ready.

## The `Plugin` API

All methods are available on the global `Plugin` object inside the plugin sandbox.

### `Plugin.onLoad(handler)`

Registers a function to run when the plugin sandbox finishes loading.

```js
Plugin.onLoad(async function () {
  // Your plugin initialization code here
});
```

### `Plugin.showText(text)`

Sends a text message that appears in the plugin's output area in the Routix UI.

```js
Plugin.showText("Hello from the plugin!");
```

### `Plugin.error(message)`

Sends an error message that appears in the plugin's output area.

```js
Plugin.error("Something went wrong: " + err.message);
```

### `Plugin.createActivity(data)`

Creates a new activity through Routix's shared creation workflow. Returns a Promise that resolves to the created activity object.

```js
const activity = await Plugin.createActivity({
  title: "My Activity",
  description: "What this activity is about",
  priority: "medium",   // "low" | "medium" | "high"
  type: "normal",       // "normal" | "timed" | "follow_up" | "multi_activities"
  typeData: null,       // type-specific data (see below)
  schedule: "normal",   // "normal" | "weekly" | "interval"
  scheduleData: null,   // ["monday", "wednesday"] for weekly, "3" for interval
  time: { hours: 9, minutes: 0 },
});
```

**Validation**: The same rules apply as for Routix-created activities:
- `title` is required
- `timed` activities need a duration (`typeData.hours` or `typeData.minutes`)
- `follow_up` and `multi_activities` need at least one step/task

**Scheduling conflicts**: If the activity's time overlaps with an existing activity, the Promise rejects with a conflict error. The plugin should catch and display this to the user.

**Source tagging**: The activity is automatically tagged with the plugin's `id` from `config.json` in the `app` column.

### `Plugin.getActivities()`

Returns a Promise that resolves to an array of activities owned by this plugin (filtered by `app === pluginId`).

```js
const activities = await Plugin.getActivities();
activities.forEach((a) => console.log(a.title, a.id));
```

### `Plugin.updateActivity(id, data)`

Updates an existing activity. Returns a Promise that resolves to the updated activity.

Only the owning plugin (or Routix itself, `app === "routix"`) can update an activity.

```js
await Plugin.updateActivity(activityId, {
  title: "Updated title",
  status: "completed",
});
```

### `Plugin.deleteActivity(id)`

Soft-deletes an activity (sets `deleted_at`). Returns a Promise.

Only the owning plugin (or Routix itself) can delete an activity.

```js
await Plugin.deleteActivity(activityId);
```

## Activity data model

| Field        | Type               | Description                                            |
|--------------|--------------------|--------------------------------------------------------|
| `id`         | number\|string     | Database primary key                                   |
| `title`      | string             | Activity title                                         |
| `description`| string             | Activity description                                   |
| `priority`   | string             | `"low"` \| `"medium"` \| `"high"`                      |
| `type`       | string             | `"normal"` \| `"timed"` \| `"follow_up"` \| `"multi_activities"` |
| `typeData`   | any                | Type-specific data (JSON)                              |
| `schedule`   | string             | `"normal"` \| `"weekly"` \| `"interval"`               |
| `scheduleData`| any               | Days array for weekly, interval string for interval    |
| `time`       | {\| null}          | `{ hours, minutes }` or null                           |
| `app`        | string             | Source: `"routix"` or plugin `id`                      |
| `createdAt`  | number\|null       | Creation timestamp                                     |
| `status`     | string             | `"pending"` \| `"in_progress"` \| `"completed"`        |
| `deletedAt`  | number\|null       | Soft-delete timestamp                                  |

## Type-specific data (`typeData`)

- **`normal`**: `null`
- **`timed`**: `{ hours: number, minutes: number }` — duration of the activity
- **`follow_up`**: `[{ id: string, title: string }]` — ordered list of follow-up steps
- **`multi_activities`**: `[{ id: string, title: string, type: string, duration: number }]` — list of sub-activities

## Schedule patterns

- **`normal`**: Daily reminder at the configured `time`
- **`weekly`**: Reminder on selected days at the configured `time`. `scheduleData` is an array of weekday names (e.g. `["monday", "wednesday"]`).
- **`interval`**: Reminder every N days at the configured `time`. `scheduleData` is a string number (e.g. `"3"` for every 3 days).

## Error handling

All async Plugin methods return Promises. The plugin should catch errors and handle them gracefully:

```js
try {
  await Plugin.createActivity({ ... });
} catch (err) {
  Plugin.error(err instanceof Error ? err.message : String(err));
}
```

Common error scenarios:
- **Scheduling conflict**: The activity overlaps with an existing one.
- **Not authorized**: The plugin tries to modify an activity owned by another plugin or by Routix.
- **Activity not found**: The activity ID doesn't exist or has been soft-deleted.
- **Validation failure**: Required fields are missing or invalid.

## Ownership and authorization

- A plugin can only create, update, or delete activities where `app === pluginId`.
- Routix activities (`app === "routix"`) can be updated or deleted by any plugin, but the plugin should respect user intent and not modify Routix-managed activities without a clear reason.
- Activities from another plugin (`app === "other-plugin-id"`) cannot be modified by this plugin.

## Avoiding duplicates

When a plugin is reloaded (e.g. the user toggles it on/off), the sandbox re-runs. To avoid creating duplicate activities, check existing activities before creating:

```js
const existing = await Plugin.getActivities();
if (existing.length > 0) {
  // Already initialized, skip creation
  return;
}
await Plugin.createActivity({ ... });
```

## Testing locally

1. Install the plugin in Routix via the Plugins screen (provide a URL to the plugin's `index.js`).
2. Open the Plugins tab and run the plugin.
3. Check the output area for `showText` messages.
4. Go to the Home or Activities screen to verify the activity appears.
5. Edit or delete the activity from the detail screen.
6. Verify the activity source shows the plugin identifier.

## Building and troubleshooting

### Prerequisites

- Node.js and npm
- Expo CLI (`npx expo`)
- Android Studio (for Android builds)

### Installing dependencies

```bash
cd Routix  # the main Routix app
npm install
```

### Rebuilding native Android

The `react-native-webview` native module must be linked. Rebuild Android:

```bash
cd Routix
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
npx expo start -c
```

### Common issues

- **`RncWebViewModule could not be found`**: The `react-native-webview` native module is not registered. Make sure `MainApplication.kt` adds `RNCWebViewPackage()` to the `PackageList`, and `android/settings.gradle` + `android/app/build.gradle` include the `react-native-webview` project.
- **Plugin code doesn't run**: Check that the WebView bridge is ready. The sandbox polls for `window.ReactNativeWebView` and sends a `ready` message before running plugin code.
- **Activity creation fails**: Check the plugin output area for error messages. Scheduling conflicts and validation errors are reported through `Plugin.error`.

## Files changed in this plugin

- `config.json` — Added `id` field for stable plugin identification
- `index.js` — Updated to demonstrate activity creation through the shared Routix API
- `README.md` — This file
