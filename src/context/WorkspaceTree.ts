import { WorkspaceNode } from './types';

/**
 * C2: Dynamic Workspace Tree
 * Maintains the client's internal state for workspace structure.
 * Supports CRUD on workspace nodes and keeps a hierarchical view.
 */
export class WorkspaceTree {
  private root: WorkspaceNode;
  private nodes: Map<string, WorkspaceNode> = new Map();

  constructor() {
    this.root = {
      id: 'root',
      name: 'Workspace',
      type: 'directory',
      path: '/',
      children: [],
    };
    this.nodes.set('root', this.root);
  }

  /**
   * Add a node to the tree.
   */
  addNode(parentId: string, node: WorkspaceNode): boolean {
    const parent = this.nodes.get(parentId);
    if (!parent) return false;

    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(node);
    this.nodes.set(node.id, node);
    return true;
  }

  /**
   * Get a node by ID.
   */
  getNode(id: string): WorkspaceNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get root node.
   */
  getRoot(): WorkspaceNode {
    return this.root;
  }

  /**
   * Get total node count.
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Remove a node by ID.
   */
  removeNode(id: string): boolean {
    if (id === 'root') return false;
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove from parent's children
    const removeFromChildren = (list: WorkspaceNode[]): boolean => {
      const idx = list.findIndex((n) => n.id === id);
      if (idx >= 0) {
        list.splice(idx, 1);
        this.nodes.delete(id);
        return true;
      }
      for (const child of list) {
        if (child.children && removeFromChildren(child.children)) {
          return true;
        }
      }
      return false;
    };

    return removeFromChildren(this.root.children ?? []);
  }

  /**
   * Find nodes by name (case-insensitive).
   */
  findByName(name: string): WorkspaceNode[] {
    const results: WorkspaceNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.name.toLowerCase().includes(name.toLowerCase())) {
        results.push(node);
      }
    }
    return results;
  }

  /**
   * Flatten tree into array.
   */
  flatten(): WorkspaceNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Serialize to JSON.
   */
  toJSON(): string {
    return JSON.stringify(this.root, null, 2);
  }

  /**
   * Load from JSON.
   */
  static fromJSON(json: string): WorkspaceTree {
    const tree = new WorkspaceTree();
    const root = JSON.parse(json);
    tree.root = root;
    tree.rebuildIndex(root);
    return tree;
  }

  private rebuildIndex(node: WorkspaceNode) {
    this.nodes.set(node.id, node);
    if (node.children) {
      for (const child of node.children) {
        this.rebuildIndex(child);
      }
    }
  }
}
