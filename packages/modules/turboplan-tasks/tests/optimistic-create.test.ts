/**
 * Optimistic creates insert a `temp-…` placeholder. Once the API answers, the
 * placeholder must carry the server id, or every later update/delete is sent
 * with the temp id and fails. These tests drive the real store through the
 * operation factories with a stubbed service.
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { StoreApi } from "zustand";

import { createErrorHandler } from "../src/hooks/useProjectTasks/errorHandler";
import { createMilestoneOperations } from "../src/hooks/useProjectTasks/milestoneOperations";
import { createOptimisticExecutor } from "../src/hooks/useProjectTasks/optimisticUpdates";
import { createTaskOperations } from "../src/hooks/useProjectTasks/taskOperations";
import { useTaskStore } from "../src/stores/task-store";
import type { Milestone, MilestoneWithTasks, Task } from "../src/types";
import { TaskStatus } from "../src/types";
import type { ITaskDataService } from "../src/types/service";

type TaskStoreState = ReturnType<typeof useTaskStore>;

// The store is exported typed as a bare hook; the zustand API is still on it.
const store = useTaskStore as unknown as StoreApi<TaskStoreState>;

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const MILESTONE_ID = "33333333-3333-4333-8333-333333333333";
const SERVER_TASK_ID = "44444444-4444-4444-8444-444444444444";
const SERVER_MILESTONE_ID = "55555555-5555-4555-8555-555555555555";
const USER_ID = "11111111-1111-4111-8111-111111111111";

const NOW = new Date("2026-10-26T00:00:00Z");

const milestoneRow = (id: string): Milestone => ({
  id,
  title: "Phase 1",
  status: TaskStatus.NOT_STARTED,
  assigneeIds: [],
  startDate: NOW,
  dueDate: NOW,
  userId: USER_ID,
  documentId: PROJECT_ID,
  projectId: PROJECT_ID,
  order: 0,
  createdAt: NOW,
  updatedAt: NOW,
});

const taskRow = (id: string): Task => ({
  id,
  title: "Survey the site",
  description: null,
  status: TaskStatus.NOT_STARTED,
  assigneeIds: [],
  dependencies: [],
  projectDocumentIds: [],
  startDate: NOW,
  dueDate: NOW,
  milestoneId: MILESTONE_ID,
  userId: USER_ID,
  documentId: PROJECT_ID,
  order: 0,
  createdAt: NOW,
  updatedAt: NOW,
});

const stubService = (overrides: Partial<ITaskDataService>) =>
  overrides as ITaskDataService;

// Wired like the hook: a failure lands in the store's error state.
const executeOptimistic = createOptimisticExecutor(
  createErrorHandler((error) => store.getState().setError(error)),
);

// Rebuilt per call with the current milestones, as the hook does on re-render.
const taskOperations = (taskService: ITaskDataService) => {
  const state = store.getState();
  return createTaskOperations({
    projectId: PROJECT_ID,
    milestones: state.milestones,
    storeActions: state,
    executeOptimistic,
    taskService,
  });
};

const milestoneOperations = (taskService: ITaskDataService) => {
  const state = store.getState();
  return createMilestoneOperations({
    projectId: PROJECT_ID,
    milestones: state.milestones,
    storeActions: state,
    executeOptimistic,
    taskService,
  });
};

const allTaskIds = () =>
  store.getState().milestones.flatMap((m) => m.tasks.map((t) => t.id));

beforeEach(() => {
  store.getState().initializeMilestones([]);
  store.getState().setError(null);
});

describe("createTask", () => {
  beforeEach(() => {
    store
      .getState()
      .initializeMilestones([{ ...milestoneRow(MILESTONE_ID), tasks: [] }]);
  });

  it("swaps the temp task for the server one, so a later delete uses the real id", async () => {
    const deletedIds: string[] = [];
    const service = stubService({
      createTask: async () => taskRow(SERVER_TASK_ID),
      deleteTask: async (taskId) => {
        deletedIds.push(taskId);
      },
    });

    await taskOperations(service).createTask(MILESTONE_ID, {
      title: "Survey the site",
    });

    assert.deepEqual(allTaskIds(), [SERVER_TASK_ID]);

    await taskOperations(service).deleteTask(SERVER_TASK_ID);

    assert.deepEqual(deletedIds, [SERVER_TASK_ID]);
    assert.deepEqual(allTaskIds(), []);
  });

  it("drops the temp task when the API rejects the create", async () => {
    const service = stubService({
      createTask: async () => {
        throw new Error("Internal Server Error");
      },
    });

    await assert.rejects(
      taskOperations(service).createTask(MILESTONE_ID, { title: "Survey" }),
    );

    assert.deepEqual(allTaskIds(), []);
    assert.equal(store.getState().error, "Internal Server Error");
  });
});

describe("createMilestone", () => {
  it("swaps the temp milestone for the server one and moves its UI state", async () => {
    const service = stubService({
      createMilestone: async () => milestoneRow(SERVER_MILESTONE_ID),
    });

    await milestoneOperations(service).createMilestone({ title: "Phase 1" });

    const { milestones, expandedMilestones, milestonesOpenStatus } =
      store.getState();
    assert.deepEqual(
      milestones.map((m) => [m.id, m.tasks]),
      [[SERVER_MILESTONE_ID, []]],
    );
    assert.deepEqual(expandedMilestones, { [SERVER_MILESTONE_ID]: true });
    assert.deepEqual(milestonesOpenStatus, { [SERVER_MILESTONE_ID]: true });
  });
});

describe("replaceMilestone", () => {
  it("keeps the milestone's tasks and a collapse made while the create was in flight", () => {
    const tempId = "temp-milestone-1";
    const placeholder: MilestoneWithTasks = {
      ...milestoneRow(tempId),
      tasks: [taskRow(SERVER_TASK_ID)],
    };
    const { addMilestone, toggleMilestone, replaceMilestone } =
      store.getState();

    addMilestone(placeholder);
    toggleMilestone(tempId);
    replaceMilestone(tempId, milestoneRow(SERVER_MILESTONE_ID));

    const { milestones, expandedMilestones, milestonesOpenStatus } =
      store.getState();
    assert.deepEqual(
      milestones.map((m) => [m.id, m.tasks.map((t) => t.id)]),
      [[SERVER_MILESTONE_ID, [SERVER_TASK_ID]]],
    );
    assert.deepEqual(expandedMilestones, { [SERVER_MILESTONE_ID]: false });
    assert.deepEqual(milestonesOpenStatus, { [SERVER_MILESTONE_ID]: false });
  });
});
