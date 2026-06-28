import * as Notifications from "expo-notifications";

// Configure default notification presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests push notification permissions.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    return newStatus === "granted";
  }
  return true;
}

/**
 * Schedules a daily hydration reminder.
 */
export async function scheduleDailyHydration(name: string) {
  await cancelDailyHydration();

  const messages = [
    `Drink up, ${name}! A warm glass of water or ginger tea keeps your cycle flowing smoothly 💧`,
    `Hey beautiful! Time for a quick hydration break. Your body will thank you! 🌸`,
    `Hydration Check! Keep your energy levels up today with a refreshing cup of water 💦`,
  ];
  const body = messages[Math.floor(Math.random() * messages.length)];

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: "daily-hydration",
      content: {
        title: "Hydration Check 🌸",
        body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 10,
        minute: 0,
      },
    });
  } catch (err) {
    console.warn("Failed to schedule daily hydration alert:", err);
  }
}

/**
 * Cancels the scheduled daily hydration reminder.
 */
export async function cancelDailyHydration() {
  try {
    await Notifications.cancelScheduledNotificationAsync("daily-hydration");
  } catch {}
}

/**
 * Schedules a warning reminder 3 days before the predicted next period.
 */
export async function scheduleCycleReminder(predictedNextPeriod: string | null) {
  await cancelCycleReminder();
  if (!predictedNextPeriod) return;

  const targetDate = new Date(predictedNextPeriod);
  targetDate.setDate(targetDate.getDate() - 3);
  targetDate.setHours(9, 0, 0, 0); // 9:00 AM

  if (targetDate.getTime() > Date.now()) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: "cycle-reminder",
        content: {
          title: "Period Care Reminder 💕",
          body: "Your predicted cycle is starting in 3 days. Take it easy, stock up on essentials, and pamper yourself today! 🌸",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
        },
      });
    } catch (err) {
      console.warn("Failed to schedule cycle prediction alert:", err);
    }
  }
}

/**
 * Cancels the scheduled cycle reminder.
 */
export async function cancelCycleReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync("cycle-reminder");
  } catch {}
}

/**
 * Configures all active notifications for the user.
 */
export async function setupAllNotifications(
  name: string,
  predictedNextPeriod: string | null
): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await scheduleDailyHydration(name);
  await scheduleCycleReminder(predictedNextPeriod);
  return true;
}

/**
 * Disables and cancels all scheduled alerts.
 */
export async function disableAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}
