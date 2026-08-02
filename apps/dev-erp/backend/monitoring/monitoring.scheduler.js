import { mapWithConcurrency } from "./siteStatus.js";

const SCHEDULER_STATE_KEY = Symbol.for("faako.dev-erp.monitoring.scheduler");

export const createMonitoringScheduler = ({ services, monitoringService, options, logger, now = () => Date.now(), random = Math.random }) => {
  const state = { running: new Set(), lastRunAt: new Map(), timer: null, stopped: false };

  const runDueChecks = async () => {
    const currentTime = now();
    const due = services.filter((service) => {
      if (!service.enabled || state.running.has(service.key)) return false;
      const lastRun = state.lastRunAt.get(service.key) || 0;
      return currentTime - lastRun >= service.intervalSeconds * 1000;
    });
    await mapWithConcurrency(due, options.maxConcurrency, async (service) => {
      state.running.add(service.key);
      state.lastRunAt.set(service.key, currentTime);
      try {
        return await monitoringService.runService(service.key);
      } catch (error) {
        logger?.failure("monitoring.scheduler.check_failed", service, error);
        return null;
      } finally {
        state.running.delete(service.key);
      }
    });
    return due.length;
  };

  const start = () => {
    if (state.timer || state.stopped) return state;
    const jitterMs = Math.floor(random() * Math.min(options.schedulerTickMs, 5000));
    state.timer = setInterval(() => { void runDueChecks().catch((error) => logger?.failure("monitoring.scheduler.tick_failed", null, error)); }, options.schedulerTickMs);
    state.timer.unref?.();
    const initialTimer = setTimeout(() => { void runDueChecks().catch((error) => logger?.failure("monitoring.scheduler.initial_failed", null, error)); }, jitterMs);
    initialTimer.unref?.();
    return state;
  };

  const stop = () => {
    state.stopped = true;
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  };

  return { state, runDueChecks, start, stop };
};

export const startSingletonMonitoringScheduler = (config) => {
  const existing = globalThis[SCHEDULER_STATE_KEY];
  if (existing) return existing;
  const scheduler = createMonitoringScheduler(config);
  globalThis[SCHEDULER_STATE_KEY] = scheduler;
  scheduler.start();
  return scheduler;
};
