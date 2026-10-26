import {
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

/** `POST /api/tasks/document/:projectId` creates a task. */
const CREATE_TASK_PATH = /^\/api\/tasks\/document\/[^/]+$/;
/** `PUT` / `DELETE /api/tasks/:id` update or delete one. */
const TASK_PATH = /^\/api\/tasks\/[^/]+$/;

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
 * is the cell's nearest `draggable` ancestor. Mutations return the API
 * response so a spec can check which id the client used.
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
    const response = await responsePromise;
    expect(response.status(), "POST /api/tasks/document/:id status").toBe(201);
    const body = (await response.json()) as { task: { id: string } };

    await expect(dialog).toBeHidden();
    await expect(this.taskTitle(title)).toBeVisible();

    return body.task.id;
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

    // The inline editor replaces the title cell, so it cannot be found from
    // the title. Only one editor is open at a time; its input sits next to
    // the Save/Cancel buttons.
    const input = this.page
      .getByTitle("Save (Enter)")
      .locator("xpath=../../input");
    await input.fill(newTitle);

    const responsePromise = this.waitForTaskMutation("PUT");
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

  private waitForTaskMutation(method: "PUT" | "DELETE"): Promise<Response> {
    return this.page.waitForResponse(
      (response) =>
        response.request().method() === method &&
        TASK_PATH.test(pathnameOf(response)),
    );
  }
}
