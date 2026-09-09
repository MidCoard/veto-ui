import { describe, expect, it } from 'vitest';
import { diagramFailure } from './diagramPolicy';

describe('diagram presentation profile', () => {
  it.each([
    'flowchart TD\nA["请求"] --> B["执行"]',
    'sequenceDiagram\nAlice->>Bob: Hello',
    'stateDiagram-v2\n[*] --> Idle',
    'erDiagram\nUSER ||--o{ ORDER : places',
    'classDiagram\nAnimal <|-- Duck',
    'flowchart LR\nA["Choose image"] --> B["Preview"]',
    'flowchart LR\nA[Image style] --> B[Preview]',
    'sequenceDiagram\nUI->>API: Register callback',
    'stateDiagram-v2\nstate Decision <<choice>>',
    'classDiagram\nclass Service\n<<interface>> Service',
    'flowchart LR\naccDescr: Click an image to preview it.\nA --> B',
    'flowchart LR\naccDescr {\nClick an image to preview it.\n}\nA --> B',
  ])('accepts supported self-contained syntax: %s', (source) => expect(diagramFailure(source)).toBeUndefined());

  it.each([
    '%%{init: {"themeCSS":"bad"}}%%\nflowchart LR\nA --> B',
    '  %%  { init: {} } %%\nflowchart LR\nA --> B',
    '\ufeff---\nconfig: {}\n---\nflowchart LR\nA --> B',
    'flowchart LR\nA --> B\nclick A "https://example.com"',
    'flowchart LR\nA["<img src=x>"]',
    'flowchart LR\nclassDef bad fill:red\nA --> B',
    'flowchart LR; A --> B; style A fill:red',
    'flowchart LR\nclick A callback',
    'flowchart LR\naccDescr {\nOrdinary description.\n}\nclick A callback',
  ])('rejects unsafe features before rendering: %s', (source) => expect(diagramFailure(source)).toBe('unsafe'));

  it('measures UTF-8 bytes and rejects non-profile types', () => {
    expect(diagramFailure('flowchart LR\n' + '中'.repeat(6000))).toBe('size');
    expect(diagramFailure('gantt\ntitle Example')).toBe('unsupported');
  });
});
