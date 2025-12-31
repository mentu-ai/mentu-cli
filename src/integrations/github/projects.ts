import type { Octokit } from '@octokit/rest';

export interface ProjectV2 {
  id: string;
  title: string;
  number: number;
  url: string;
}

export interface ProjectColumn {
  id: string;
  name: string;
}

export interface ProjectItem {
  id: string;
  fieldValues: Record<string, string>;
}

/**
 * GitHub Projects v2 GraphQL operations.
 * Note: Projects v2 requires GraphQL API, not REST.
 */
export class GitHubProjectsClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(octokit: Octokit, owner: string, repo: string) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Find a project by name.
   */
  async findProject(projectName: string): Promise<ProjectV2 | null> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          projectsV2(first: 20) {
            nodes {
              id
              title
              number
              url
            }
          }
        }
      }
    `;

    try {
      const response = await this.octokit.graphql<{
        repository: {
          projectsV2: {
            nodes: ProjectV2[];
          };
        };
      }>(query, { owner: this.owner, repo: this.repo });

      const project = response.repository.projectsV2.nodes.find(
        (p) => p.title.toLowerCase() === projectName.toLowerCase()
      );

      return project ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Add an issue to a project.
   */
  async addIssueToProject(
    projectId: string,
    issueNodeId: string
  ): Promise<string | null> {
    const mutation = `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
          item {
            id
          }
        }
      }
    `;

    try {
      const response = await this.octokit.graphql<{
        addProjectV2ItemById: {
          item: {
            id: string;
          };
        };
      }>(mutation, { projectId, contentId: issueNodeId });

      return response.addProjectV2ItemById.item.id;
    } catch {
      return null;
    }
  }

  /**
   * Get the Status field ID and options for a project.
   */
  async getStatusField(
    projectId: string
  ): Promise<{ fieldId: string; options: Array<{ id: string; name: string }> } | null> {
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 20) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.octokit.graphql<{
        node: {
          fields: {
            nodes: Array<{
              id?: string;
              name?: string;
              options?: Array<{ id: string; name: string }>;
            }>;
          };
        };
      }>(query, { projectId });

      const statusField = response.node.fields.nodes.find(
        (f) => f.name?.toLowerCase() === 'status' && f.options
      );

      if (!statusField || !statusField.id || !statusField.options) {
        return null;
      }

      return {
        fieldId: statusField.id,
        options: statusField.options,
      };
    } catch {
      return null;
    }
  }

  /**
   * Update item status in project.
   */
  async updateItemStatus(
    projectId: string,
    itemId: string,
    statusFieldId: string,
    statusOptionId: string
  ): Promise<boolean> {
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: $value
        }) {
          projectV2Item {
            id
          }
        }
      }
    `;

    try {
      await this.octokit.graphql(mutation, {
        projectId,
        itemId,
        fieldId: statusFieldId,
        value: { singleSelectOptionId: statusOptionId },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Map Mentu commitment state to GitHub Projects column.
   */
  mapStateToColumn(state: 'open' | 'claimed' | 'in_review' | 'closed' | 'reopened'): string {
    const mapping: Record<string, string> = {
      open: 'Backlog',
      claimed: 'In Progress',
      in_review: 'In Review',
      closed: 'Done',
      reopened: 'In Progress',
    };
    return mapping[state] ?? 'Backlog';
  }
}
