import { expect, type Page, type Response, test } from "@playwright/test";

import { NEW_MILESTONE_TITLE, TurboplanProjectTasksPage } from "../../pages";
import {
  createTestMilestone,
  createTestProjectInOffice,
  getCitizenWorkspace,
  type WorkspaceInfo,
} from "../../utils";

/**
 * Acting on a task or milestone in the Gantt view right after creating it,
 * with no reload.
 *
 * "+ Add Task" and "+ Add Milestone" put the new row in the table at once
 * under an optimistic `temp-<uuid>` (or `temp-milestone-<uuid>`) id.
 * Regressions:
 * - The client kept that id after the server answered, so the next delete or
 *   update went to `/api/tasks/temp-…` and failed while the table still
 *   showed the change. A deleted task came back after a reload, and a status
 *   change or rename was lost.
 * - "+ Add Milestone" posted an empty body. The API refused it (400: title
 *   required) and the whole view switched to "Error loading tasks".
 *
 * Runs as the citizen user (default auth state). Each test gets its own
 * project with one seeded milestone (the "+ Add Milestone" row only shows
 * once there is one), so the tests stay independent when they run in
 * parallel.
 */

const shortId = (): string => Math.random().toString(36).substring(2, 8);

const TEMP_ID_PATH = /^\/api\/(tasks|milestones)\/temp-/;

/** Collects every API request that names an optimistic id ("METHOD /path"). */
const recordTempIdRequests = (page: Page): string[] => {
  const requests: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (TEMP_ID_PATH.test(pathname)) {
      requests.push(`${request.method()} ${pathname}`);
    }
  });
  return requests;
};

/** The mutation went to `path`, which names the server's id, and succeeded. */
const expectSucceededAt = (response: Response, path: string) => {
  const method = response.request().method();
  const sent = `${method} ${new URL(response.url()).pathname}`;
  expect(sent, "the client should call the API with the server's id").toBe(
    `${method} ${path}`,
  );
  expect(response.ok(), `${sent} answered ${response.status()}`).toBe(true);
};

const expectSucceededForTask = (response: Response, taskId: string) => {
  expectSucceededAt(response, `/api/tasks/${taskId}`);
};

const expectSucceededForMilestone = (
  response: Response,
  milestoneId: string,
) => {
  expectSucceededAt(response, `/api/milestones/${milestoneId}`);
};

test.describe("Actions right after creating a task or milestone", () => {
  let workspace: WorkspaceInfo;
  let projectId: string;
  let milestoneTitle: string;
  let tasksPage: TurboplanProjectTasksPage;
  let tempIdRequests: string[];

  test.beforeAll(async () => {
    workspace = await getCitizenWorkspace();
  });

  test.beforeEach(async ({ page }) => {
    const project = await createTestProjectInOffice({
      name: `Optimistic Tasks ${shortId()}`,
      officeId: workspace.officeId,
      createdBy: workspace.userId,
    });
    projectId = project.id;
    milestoneTitle = `E2E Milestone ${shortId()}`;
    await createTestMilestone({
      projectId: project.id,
      userId: workspace.userId,
      title: milestoneTitle,
    });

    tempIdRequests = recordTempIdRequests(page);
    tasksPage = new TurboplanProjectTasksPage(page);
    await tasksPage.goto({
      orgSlug: workspace.orgSlug,
      officeSlug: workspace.officeSlug,
      projectSlug: project.slug,
    });
    await tasksPage.expectMilestone(milestoneTitle);
  });

  /** Create a task, then wait for its row to carry the server's id. */
  const createTask = async (title: string): Promise<string> => {
    const taskId = await tasksPage.createTask(
      title,
      "Created by the task-actions-after-create e2e spec",
    );

    // Swapping in the real id re-keys (re-mounts) the row, so wait for it
    // before using the row. Soft, so that a regression still goes on to
    // report the request it sends with the temp id.
    await expect
      .soft(
        tasksPage.taskTitle(title),
        "the new row should carry the server's task id, not an optimistic temp id",
      )
      .toHaveAttribute("data-task-title", taskId);

    return taskId;
  };

  test("a deleted task stays deleted after a reload", async ({ page }) => {
    const title = `Delete me ${shortId()}`;
    const taskId = await createTask(title);

    const response = await tasksPage.deleteTask(title);
    expectSucceededForTask(response, taskId);
    await expect(tasksPage.taskTitle(title)).toHaveCount(0);

    await page.reload();
    await tasksPage.expectMilestone(milestoneTitle);
    await expect(
      tasksPage.taskTitle(title),
      "the deleted task should not come back after a reload",
    ).toHaveCount(0);
    expect(tempIdRequests, "requests sent with a temp id").toEqual([]);
  });

  test("a status change is kept after a reload", async ({ page }) => {
    const title = `Start me ${shortId()}`;
    const taskId = await createTask(title);

    const response = await tasksPage.changeTaskStatus(
      title,
      "Initiate",
      "In Progress",
    );
    expectSucceededForTask(response, taskId);
    await expect(tasksPage.statusButton(title, "In Progress")).toBeVisible();

    await page.reload();
    await tasksPage.expectMilestone(milestoneTitle);
    await expect(
      tasksPage.statusButton(title, "In Progress"),
      "the new status should be kept after a reload",
    ).toBeVisible();
    expect(tempIdRequests, "requests sent with a temp id").toEqual([]);
  });

  test("a rename is kept after a reload", async ({ page }) => {
    const title = `Rename me ${shortId()}`;
    const newTitle = `Renamed ${shortId()}`;
    const taskId = await createTask(title);

    const response = await tasksPage.renameTask(title, newTitle);
    expectSucceededForTask(response, taskId);
    await expect(tasksPage.taskTitle(newTitle)).toBeVisible();

    await page.reload();
    await tasksPage.expectMilestone(milestoneTitle);
    await expect(
      tasksPage.taskTitle(newTitle),
      "the new title should be kept after a reload",
    ).toBeVisible();
    await expect(tasksPage.taskTitle(title)).toHaveCount(0);
    expect(tempIdRequests, "requests sent with a temp id").toEqual([]);
  });

  test("a new milestone can be renamed, given a task and deleted", async ({
    page,
  }) => {
    const { response: created, optimisticTitle } =
      await tasksPage.addMilestone();
    expect(
      created.ok(),
      `POST /api/milestones/document/${projectId} answered ${created.status()}: ${await created.text()}`,
    ).toBe(true);
    const { milestone } = (await created.json()) as {
      milestone: { id: string; title: string };
    };
    expect(milestone.title, "the milestone should be saved as shown").toBe(
      NEW_MILESTONE_TITLE,
    );

    // Swapping in the real id re-keys (re-mounts) the row, so wait for it
    // before using the row. Soft, so that a regression still goes on to
    // report the request it sends with the temp id.
    await expect
      .configure({ soft: true })
      .poll(() => optimisticTitle.evaluate((cell) => cell.isConnected), {
        message: "the row should re-mount under the server's milestone id",
      })
      .toBe(false);
    await expect(tasksPage.milestoneTitle(NEW_MILESTONE_TITLE)).toBeVisible();
    await expect(tasksPage.loadError()).toHaveCount(0);

    const newTitle = `Renamed milestone ${shortId()}`;
    const renamed = await tasksPage.renameMilestone(
      NEW_MILESTONE_TITLE,
      newTitle,
    );
    expectSucceededForMilestone(renamed, milestone.id);
    await expect(tasksPage.milestoneTitle(newTitle)).toBeVisible();

    const taskTitle = `In new milestone ${shortId()}`;
    const taskCreated = await tasksPage.createTaskInMilestone(
      newTitle,
      taskTitle,
      "Created by the task-actions-after-create e2e spec",
    );
    expect(
      taskCreated.request().postDataJSON()?.milestoneId,
      "the new task should name the server's milestone id",
    ).toBe(milestone.id);
    expect(
      taskCreated.ok(),
      `POST /api/tasks/document/${projectId} answered ${taskCreated.status()}`,
    ).toBe(true);
    await expect(tasksPage.taskTitle(taskTitle)).toBeVisible();

    const deleted = await tasksPage.deleteMilestone(newTitle);
    expectSucceededForMilestone(deleted, milestone.id);
    await expect(tasksPage.milestoneTitle(newTitle)).toHaveCount(0);
    await expect(tasksPage.taskTitle(taskTitle)).toHaveCount(0);
    await expect(tasksPage.loadError()).toHaveCount(0);

    await page.reload();
    await tasksPage.expectMilestone(milestoneTitle);
    await expect(
      tasksPage.milestoneTitle(newTitle),
      "the deleted milestone should not come back after a reload",
    ).toHaveCount(0);
    await expect(tasksPage.milestoneTitle(NEW_MILESTONE_TITLE)).toHaveCount(0);
    await expect(tasksPage.taskTitle(taskTitle)).toHaveCount(0);
    expect(tempIdRequests, "requests sent with a temp id").toEqual([]);
  });
});
