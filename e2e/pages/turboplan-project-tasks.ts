import {
  type ElementHandle,
  expect,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

/** Labels of the task status button. A new task is a draft ("Initiate"). */
export type TaskStatusLabel =
  | "Initiate"
  | "Not Started"
  | "In Progress"
  | "Complete"
  | "Delayed";

/** Items of a milestone row's menu. */
type MilestoneAction = "Rename" | "Add task" | "Delete milestone";

/** The title "Add Milestone" gives the milestone it creates. */
export const NEW_MILESTONE_TITLE = "New Milestone";

/** `POST /api/tasks/document/:projectId` creates a task. */
const CREATE_TASK_PATH = /^\/api\/tasks\/document\/[^/]+$/;
/** `PUT` / `DELETE /api/tasks/:id` update or delete one. */
const TASK_PATH = /^\/api\/tasks\/[^/]+$/;
/** `POST /api/milestones/document/:projectId` creates a milestone. */
const CREATE_MILESTONE_PATH = /^\/api\/milestones\/document\/[^/]+$/;
/** `PUT` / `DELETE /api/milestones/:id` update or delete one. */
const MILESTONE_PATH = /^\/api\/milestones\/[^/]+$/;

const pathnameOf = (response: Response): string => {
  return new URL(response.url()).pathname;
};

/**
 * Page Object Model for a project's Tasks page (`/:org/:office/:project/tasks`),
 * which opens on the Gantt view: a table of milestone rows, each followed by
 * its task rows and a "+ Add Task" row.
 *
 * A task row has no role or test id. Its title cell carries
 * `data-task-title={task.id}`, the id the client sends to the API, and the row
 * is the cell's nearest `draggable` ancestor. A milestone row is found the
 * same way from its `data-milestone-title` cell, which carries no id.
 * Mutations return the API response so a spec can check which id the client
 * used.
 */
export class TurboplanProjectTasksPage {
  constructor(private readonly page: Page) {}

  async goto(params: {
    orgSlug: string;
    officeSlug: string;
    projectSlug: string;
  }): Promise<void> {
    const projectPath = appPaths.project(
      params.orgSlug,
      params.officeSlug,
      params.projectSlug,
    );
    await this.page.goto(`${projectPath}/tasks`);
  }

  /** A milestone's title cell (title followed by its task count). */
  milestoneTitle(title: string): Locator {
    return this.page.locator("[data-milestone-title]").filter({
      hasText: title,
    });
  }

  /**
   * Wait for the table to show the milestone. Tasks arrive in the same
   * response, so once it is visible a missing task really is missing.
   */
  async expectMilestone(title: string): Promise<void> {
    await expect(this.milestoneTitle(title)).toBeVisible({ timeout: 20000 });
  }

  milestoneRow(title: string): Locator {
    return this.milestoneTitle(title).locator(
      "xpath=ancestor::div[@draggable][1]",
    );
  }

  /** Shown in place of the whole table once a task operation fails. */
  loadError(): Locator {
    return this.page.getByText("Error loading tasks", { exact: true });
  }

  /** A task's title cell; its `data-task-title` is the task's client id. */
  taskTitle(title: string): Locator {
    return this.page
      .getByText(title, { exact: true })
      .and(this.page.locator("[data-task-title]"));
  }

  taskRow(title: string): Locator {
    return this.taskTitle(title).locator("xpath=ancestor::div[@draggable][1]");
  }

  /** The status dropdown trigger of a task, named by its current status. */
  statusButton(title: string, status: TaskStatusLabel): Locator {
    return this.taskRow(title).getByRole("button", {
      name: status,
      exact: true,
    });
  }

  /**
   * Create a task through "+ Add Task" (the project must have exactly one
   * milestone) and return the id the server gave it.
   */
  async createTask(title: string, description: string): Promise<string> {
    await this.page
      .getByRole("button", { name: "+ Add Task", exact: true })
      .click();

    const response = await this.submitNewTask(title, description);
    expect(response.status(), "POST /api/tasks/document/:id status").toBe(201);
    const body = (await response.json()) as { task: { id: string } };

    await expect(this.page.getByRole("alertdialog")).toBeHidden();
    await expect(this.taskTitle(title)).toBeVisible();

    return body.task.id;
  }

  /**
   * Create a task through a milestone's "Add task" menu item, which works
   * with any number of milestones. Returns the create response; its request
   * body names the milestone id the client used.
   */
  async createTaskInMilestone(
    milestoneTitle: string,
    title: string,
    description: string,
  ): Promise<Response> {
    await this.chooseMilestoneAction(milestoneTitle, "Add task");
    return this.submitNewTask(title, description);
  }

  /**
   * Add a milestone through the "Add Milestone" row at the bottom of the
   * table. The client shows a {@link NEW_MILESTONE_TITLE} row at once under an
   * optimistic `temp-milestone-<uuid>` id, then swaps in the server's id,
   * which re-keys (re-mounts) the row.
   *
   * Returns the create response and the title cell of the optimistic row. The
   * cell leaves the DOM when the swap re-mounts the row; nothing else in the
   * DOM shows a milestone's id.
   */
  async addMilestone(): Promise<{
    response: Response;
    optimisticTitle: ElementHandle;
  }> {
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        CREATE_MILESTONE_PATH.test(pathnameOf(response)),
    );
    await this.page
      .getByRole("button", { name: "+ Add Milestone", exact: true })
      .click();
    // The row appears in the click handler, before the request is even sent,
    // so this is the optimistic row: the server needs a round trip to answer.
    const optimisticTitle =
      await this.milestoneTitle(NEW_MILESTONE_TITLE).elementHandle();
    if (!optimisticTitle) {
      throw new Error(`No "${NEW_MILESTONE_TITLE}" row after Add Milestone`);
    }

    return { response: await responsePromise, optimisticTitle };
  }

  /** Rename a milestone inline through its row menu, saving with Enter. */
  async renameMilestone(title: string, newTitle: string): Promise<Response> {
    await this.chooseMilestoneAction(title, "Rename");
    return this.saveInlineTitle(newTitle, () =>
      this.waitForMilestoneMutation("PUT"),
    );
  }

  /** Delete a milestone through its row menu and the confirmation. */
  async deleteMilestone(title: string): Promise<Response> {
    await this.chooseMilestoneAction(title, "Delete milestone");

    const dialog = this.page.getByRole("alertdialog", {
      name: "Delete Milestone",
    });
    await expect(dialog).toBeVisible();

    const responsePromise = this.waitForMilestoneMutation("DELETE");
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    return responsePromise;
  }

  /** Delete a task through its row menu and the "Delete Task" confirmation. */
  async deleteTask(title: string): Promise<Response> {
    await this.chooseTaskAction(title, "Delete");

    const dialog = this.page.getByRole("alertdialog", { name: "Delete Task" });
    await expect(dialog).toBeVisible();

    const responsePromise = this.waitForTaskMutation("DELETE");
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    return responsePromise;
  }

  /** Pick a new status from the task's status dropdown. */
  async changeTaskStatus(
    title: string,
    from: TaskStatusLabel,
    to: Exclude<TaskStatusLabel, "Initiate">,
  ): Promise<Response> {
    await this.statusButton(title, from).click();

    const responsePromise = this.waitForTaskMutation("PUT");
    await this.page.getByRole("menuitem", { name: to, exact: true }).click();
    return responsePromise;
  }

  /** Rename a task inline through its row menu, saving with Enter. */
  async renameTask(title: string, newTitle: string): Promise<Response> {
    await this.chooseTaskAction(title, "Rename");
    return this.saveInlineTitle(newTitle, () =>
      this.waitForTaskMutation("PUT"),
    );
  }

  /** Fill in the new-task dialog that "Add task" opened, and submit it. */
  private async submitNewTask(
    title: string,
    description: string,
  ): Promise<Response> {
    const dialog = this.page.getByRole("alertdialog");
    await dialog.getByPlaceholder("Task title").fill(title);
    await dialog
      .getByPlaceholder("Add task description or context...")
      .fill(description);

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        CREATE_TASK_PATH.test(pathnameOf(response)),
    );
    await dialog.getByRole("button", { name: "Create Task" }).click();
    return responsePromise;
  }

  /**
   * Type a new title into the inline editor that a row menu's "Rename" opened,
   * and save it with Enter.
   */
  private async saveInlineTitle(
    newTitle: string,
    waitForMutation: () => Promise<Response>,
  ): Promise<Response> {
    // The editor replaces the title cell, so it cannot be found from the
    // title. Only one editor is open at a time; its input sits next to the
    // Save/Cancel buttons.
    const input = this.page
      .getByTitle("Save (Enter)")
      .locator("xpath=../../input");

    // The editor focuses itself, but the closing menu then hands focus back
    // to its trigger, so typing or Enter could land there. Let the menu
    // finish closing, then focus the input again.
    await expect(this.page.getByRole("menu")).toBeHidden();
    await input.focus();
    await expect(input).toBeFocused();
    await input.fill(newTitle);
    await expect(input).toHaveValue(newTitle);

    const responsePromise = waitForMutation();
    await input.press("Enter");
    return responsePromise;
  }

  private async chooseTaskAction(
    title: string,
    action: "Rename" | "Delete",
  ): Promise<void> {
    await this.taskRow(title)
      .getByRole("button", { name: "Task actions" })
      .click();
    await this.page
      .getByRole("menuitem", { name: action, exact: true })
      .click();
  }

  private async chooseMilestoneAction(
    title: string,
    action: MilestoneAction,
  ): Promise<void> {
    // The ⋮ trigger has no accessible name; it is the row's only menu button.
    await this.milestoneRow(title)
      .locator('button[aria-haspopup="menu"]')
      .click();
    // Not exact: "Add task" is preceded by a "+" in its item.
    await this.page.getByRole("menuitem", { name: action }).click();
  }

  private waitForTaskMutation(method: "PUT" | "DELETE"): Promise<Response> {
    return this.page.waitForResponse(
      (response) =>
        response.request().method() === method &&
        TASK_PATH.test(pathnameOf(response)),
    );
  }

  private waitForMilestoneMutation(
    method: "PUT" | "DELETE",
  ): Promise<Response> {
    return this.page.waitForResponse(
      (response) =>
        response.request().method() === method &&
        MILESTONE_PATH.test(pathnameOf(response)),
    );
  }
}
