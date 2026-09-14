import { DrizzleUserRepository } from "../server/repository";

export class AssigneeResolver {
  private userRepository = new DrizzleUserRepository();

  /**
   * Convert email addresses to user IDs
   */
  async resolveAssigneeIds(emails: string[]): Promise<string[]> {
    const userIds: string[] = [];
    for (const email of emails) {
      const user = await this.userRepository.findByEmail(
        email.toLowerCase().trim(),
      );
      if (user) {
        userIds.push(user.id);
      } else {
        console.warn(`User not found for email: ${email}`);
      }
    }
    return userIds;
  }

  /**
   * Get all available users for AI context
   */
  async getAvailableUsers() {
    return this.userRepository.findAll();
  }
}
