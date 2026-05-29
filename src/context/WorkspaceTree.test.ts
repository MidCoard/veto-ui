import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceTree } from './WorkspaceTree';

describe('WorkspaceTree', () => {
  let tree: WorkspaceTree;

  beforeEach(() => {
    tree = new WorkspaceTree();
  });

  it('should initialize with a root node', () => {
    expect(tree.getNodeCount()).toBe(1);
    expect(tree.getRoot().id).toBe('root');
  });

  it('should add nodes to the tree', () => {
    const newNode = {
      id: 'node-1',
      name: 'test-folder',
      type: 'directory' as const,
      path: '/test-folder',
      children: []
    };
    
    const result = tree.addNode('root', newNode);
    expect(result).toBe(true);
    expect(tree.getNodeCount()).toBe(2);
    expect(tree.getNode('node-1')).toEqual(newNode);
    expect(tree.getRoot().children).toContain(newNode);
  });

  it('should not add node if parent is missing', () => {
    const newNode = {
      id: 'node-1',
      name: 'test-folder',
      type: 'directory' as const,
      path: '/test-folder'
    };
    
    const result = tree.addNode('non-existent', newNode);
    expect(result).toBe(false);
    expect(tree.getNodeCount()).toBe(1);
  });

  it('should remove nodes from the tree', () => {
    const newNode = {
      id: 'node-1',
      name: 'test-folder',
      type: 'directory' as const,
      path: '/test-folder',
      children: []
    };
    tree.addNode('root', newNode);
    
    const result = tree.removeNode('node-1');
    expect(result).toBe(true);
    expect(tree.getNodeCount()).toBe(1);
    expect(tree.getRoot().children).not.toContain(newNode);
  });

  it('should not remove the root node', () => {
    const result = tree.removeNode('root');
    expect(result).toBe(false);
    expect(tree.getNodeCount()).toBe(1);
  });

  it('should find nodes by name', () => {
    tree.addNode('root', {
      id: 'node-1',
      name: 'Source',
      type: 'directory' as const,
      path: '/source'
    });
    tree.addNode('root', {
      id: 'node-2',
      name: 'resource',
      type: 'file' as const,
      path: '/resource.txt'
    });
    
    expect(tree.findByName('Source').length).toBe(2); // "Source" and "resource" both contain "source"
    expect(tree.findByName('resource').length).toBe(1);
    expect(tree.findByName('ou').length).toBe(2); // "Source" and "resource" both contain "ou"
  });

  it('should serialize and deserialize correctly', () => {
    tree.addNode('root', {
      id: 'node-1',
      name: 'Source',
      type: 'directory' as const,
      path: '/source',
      children: [
        {
          id: 'node-2',
          name: 'main.ts',
          type: 'file' as const,
          path: '/source/main.ts'
        }
      ]
    });
    
    const json = tree.toJSON();
    const newTree = WorkspaceTree.fromJSON(json);
    
    expect(newTree.getNodeCount()).toBe(3);
    expect(newTree.getNode('node-2')).toBeDefined();
    expect(newTree.getNode('node-2')?.name).toBe('main.ts');
  });
});
