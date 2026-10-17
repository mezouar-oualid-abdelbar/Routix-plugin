// Routix plugin: hello-world
//
// This plugin demonstrates how to integrate with Routix's shared activity
// management API. Plugins run in an isolated WebView sandbox and communicate
// with Routix through the `Plugin` global object injected by the host app.
//
// Available Plugin API methods:
//   Plugin.onLoad(handler)        - Called when the plugin sandbox loads.
//   Plugin.showText(text)         - Send a text message to the Routix UI.
//   Plugin.error(message)         - Send an error message to Routix.
//   Plugin.createActivity(data)   - Create an activity (returns a Promise).
//   Plugin.getActivities()        - List activities owned by this plugin.
//   Plugin.updateActivity(id, data) - Update an activity owned by this plugin.
//   Plugin.deleteActivity(id)     - Delete an activity owned by this plugin.
//
// The plugin identifies itself using the `id` field from config.json
// ("hello-world"). All activities created by this plugin are tagged with
// this identifier in the `app` column of the activities table.
//
// Example: create a daily reminder activity when the plugin loads.

Plugin.onLoad(async function () {
  try {
    Plugin.showText("Hello World from a real installed plugin!");

    // Check if we already have an activity to avoid duplicates on reload.
    const existing = await Plugin.getActivities();
    if (existing.length > 0) {
      Plugin.showText("Already has " + existing.length + " activity(ies).");
      return;
    }

    // Create a daily activity through Routix's shared creation workflow.
    const created = await Plugin.createActivity({
      title: "Daily Hello World",
      description: "A demo activity created by the hello-world plugin.",
      priority: "low",
      type: "normal",
      typeData: null,
      schedule: "normal",
      scheduleData: null,
      time: { hours: 9, minutes: 0 },
    });

    Plugin.showText("Activity created: " + created.title + " (id: " + created.id + ")");
  } catch (err) {
    Plugin.error(err instanceof Error ? err.message : String(err));
  }
});
