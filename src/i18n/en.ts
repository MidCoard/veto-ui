/**
 * English dictionary — the source of truth for message keys.
 * zhCN.ts must provide every key declared here (type-enforced).
 * Placeholders use {name} syntax, interpolated by t().
 */
export const en = {
  // ---- App shell ----
  'app.loading': 'Opening the ledger…',

  // ---- LoginGate ----
  'login.subtitleSetup': 'First run. Create the admin account to initialize the vault.',
  'login.subtitleSignIn': 'Sign in to open the ledger.',
  'login.username': 'Username',
  'login.usernamePlaceholder': 'admin',
  'login.password': 'Password',
  'login.passwordPlaceholderSetup': 'At least 8 characters',
  'login.passwordHint': 'At least 8 characters.',
  'login.working': 'Working…',
  'login.submitSetup': 'Initialize vault',
  'login.submitSignIn': 'Sign in',

  // ---- Backend connection ----
  'backend.connection': 'Backend connection',
  'backend.port': 'Backend port',
  'backend.portHint': 'REST and WebSocket traffic will reconnect through this port.',
  'backend.apply': 'Apply and reconnect',
  'backend.invalidPort': 'Enter a port from 1 to 65535.',

  // ---- StatusBar ----
  'status.toggleRail': 'Toggle session list',
  'status.toggleInspector': 'Toggle inspector',
  'status.busConnected': 'Bus connected',
  'status.busConnecting': 'Bus connecting',
  'status.busReconnecting': 'Bus reconnecting',
  'status.busDisconnected': 'Bus disconnected',
  'status.busActivityAria': '{status} — recent bus activity',
  'status.busActivity': 'Bus activity',
  'status.busEmpty': 'No unmatched frames. Everything on the bus has a home.',
  'status.signOut': 'Sign out',

  // ---- SessionRail ----
  'rail.sessions': 'Sessions',
  'rail.newSession': 'New session',
  'rail.pattern': 'Pattern',
  'rail.loadingPatterns': 'Loading patterns…',
  'rail.noPatterns': 'No patterns — create one first',
  'rail.name': 'Name',
  'rail.optional': '(optional)',
  'rail.namePlaceholder': 'Auto-generated if empty',
  'rail.workspaceRoots': 'Workspace roots',
  'rail.recentWorkspaces': 'Recently used',
  'rail.browse': 'Browse server…',
  'rail.browseHide': 'Hide browser',
  'rail.browseUp': 'Up',
  'rail.browseUse': 'Use this directory',
  'rail.browseDrives': 'Server drives',
  'rail.browseLoading': 'Loading…',
  'rail.browseEmpty': 'No subdirectories here.',
  'rail.creating': 'Creating…',
  'rail.create': 'Create',
  'rail.cancel': 'Cancel',
  'rail.empty': 'No sessions yet. Create one to open the ledger.',
  'rail.ledWorking': 'Working',
  'rail.ledAwaiting': 'Waiting for your decision',
  'rail.ledIdle': 'Idle',
  'rail.deleteAria': 'Delete session {name}',
  'rail.deleteConfirm': 'Delete this session?',
  'rail.deleteConfirmAll': 'All {count} sessions named "{name}" will be deleted.',
  'rail.delete': 'Delete',
  'rail.keep': 'Keep',

  // ---- VetoPromptCard (HITL) ----
  'veto.title': 'Approval required',
  'veto.hint': 'The agent paused this tool call and is waiting for your decision.',
  'veto.resolving': 'Sending your decision…',
  'veto.warnDangerous': 'DANGEROUS operation — review the command carefully before accepting.',
  'veto.warnCritical': 'CRITICAL operation — high risk. It is blocked unless you override.',
  // Option labels — keyed by the backend VetoOption enum name (the wire value;
  // it stays the button's title attribute). Unknown future options fall back
  // to a humanized enum name.
  'veto.option.ACCEPT_AND_MASK_READ': 'Accept + mask',
  'veto.option.ACCEPT_AND_MASK_READ_LIKE_THIS': 'Accept + mask, like this',
  'veto.option.ACCEPT_READ': 'Accept read',
  'veto.option.ACCEPT_READ_LIKE_THIS': 'Accept reads like this',
  'veto.option.READ_DECLINE': 'Decline read',
  'veto.option.ACCEPT_AND_MASK_WRITE': 'Accept + mask',
  'veto.option.ACCEPT_AND_MASK_WRITE_LIKE_THIS': 'Accept + mask, like this',
  'veto.option.ACCEPT_WRITE': 'Accept write',
  'veto.option.ACCEPT_WRITE_LIKE_THIS': 'Accept writes like this',
  'veto.option.ABORT_WRITE': 'Abort write',
  'veto.option.REREAD': 'Re-read first',
  'veto.option.FORCE_OVERWRITE': 'Force overwrite',
  'veto.option.EDIT': 'Edit args',
  'veto.option.BLOCK': 'Block',
  'veto.option.OVERRIDE': 'Override',
  'veto.option.ACCEPT_AND_MASK_COMMAND': 'Accept + mask',
  'veto.option.ACCEPT_AND_MASK_COMMAND_LIKE_THIS': 'Accept + mask, like this',
  'veto.option.ACCEPT_COMMAND': 'Accept command',
  'veto.option.ACCEPT_COMMAND_LIKE_THIS': 'Accept commands like this',
  'veto.option.EXEC_DECLINE': 'Decline',
  'veto.option.ACCEPT_COMMAND_ONCE': 'Accept, this once',
  'veto.option.ACCEPT_COMMAND_AS_SESSION_RULE': 'Accept for this session',
  'veto.option.ACCEPT_GENERIC': 'Accept',
  'veto.option.ACCEPT_GENERIC_LIKE_THIS': 'Accept like this',
  'veto.option.GENERIC_DECLINE': 'Decline',
  'veto.option.DECLINE_AND_CONTINUE': 'Decline, continue',

  // ---- LedgerStream ----
  'ledger.noSessionTitle': 'No session selected.',
  'ledger.noSessionHint': 'Pick a session on the left, or create a new one.',
  'ledger.emptyTitle': 'No entries yet.',
  'ledger.emptyHint': 'Send the first prompt — every turn lands here, numbered and recorded.',
  'ledger.working': 'Working',
  'ledger.thinking': 'Thinking',
  'ledger.runningTool': 'Running {tool}',

  // ---- LedgerEntry ----
  'entry.thought': 'Thought',
  'entry.tagYou': 'YOU',
  'entry.tagErr': 'ERR',
  'entry.resultOk': 'Result · ok',
  'entry.resultFailed': 'Result · failed',
  'entry.runFailed': 'Run failed — the message above is what the agent returned.',

  // ---- ToolCards (run_command / write_to_file / replace_file_content) ----
  'tool.cwd': 'cwd',
  'tool.exitCode': 'exit code {code}',
  'tool.overwrite': 'overwrite',
  'tool.replaceBefore': 'Before',
  'tool.replaceAfter': 'After',
  'tool.thinking': 'Thinking…',
  'tool.timeout': 'Wall-clock timeout the agent set for this command',
  'tool.timeoutValue': '{s}s cap',
  'tool.timeoutNoCap': 'no cap',
  'tool.task': 'task',
  'tool.taskStarted': 'task started',
  'tool.taskAlive': 'running',
  'tool.taskExit': 'exited {code}',
  'tool.taskCount': '{count} task(s)',

  // ---- Composer ----
  'composer.placeholderDisabled': 'Select a session to start.',
  'composer.placeholder': 'Send a prompt… (Enter to send, Shift+Enter for a newline)',
  'composer.cancel': 'Cancel',
  'composer.send': 'Send',
  'composer.cancelNote':
    'Cancel declines any pending approval (fail-safe) and stops waiting here — a running episode may still wind down on the backend.',

  // ---- InspectorPanel ----
  'inspector.patterns': 'Patterns',
  'inspector.tasks': 'Tasks',
  'inspector.bgTasks': 'Background tasks',

  // ---- BackgroundTasksSection ----
  'bgtasks.empty': 'No background tasks for this session.',
  'bgtasks.stop': 'Stop',
  'bgtasks.stopping': 'Stopping…',
  'bgtasks.remove': 'Remove',
  'bgtasks.removing': 'Removing…',

  // ---- Settings view ----
  'settings.title': 'Settings',
  'settings.back': 'Back to sessions',
  'settings.section.preferences': 'Preferences',
  'settings.section.modelTiers': 'Model tiers',
  'settings.section.credentials': 'Credentials',

  // ---- PreferencesSection ----
  'prefs.language': 'Language',
  'prefs.theme': 'Theme',
  'prefs.theme.dark': 'Dark',
  'prefs.theme.light': 'Light',

  // ---- ModelTiersSection ----
  'tiers.loading': 'Loading profiles…',
  'tiers.empty': 'No profiles yet.',
  'tiers.new': 'New profile',
  'tiers.closeForm': 'Close form',
  'tiers.namePlaceholder': 'Profile name',
  'tiers.creating': 'Creating…',
  'tiers.create': 'Create',
  'tiers.active': 'active',
  'tiers.activate': 'Activate',
  'tiers.deleteAria': 'Delete profile {name}',
  'tiers.deleteConfirm': 'Delete this profile?',
  'tiers.delete': 'Delete',
  'tiers.keep': 'Keep',
  'tiers.loadingBindings': 'Loading bindings…',
  'tiers.field.provider': 'Provider',
  'tiers.field.baseUrl': 'Base URL',
  'tiers.baseUrlHint':
    "Optional — leave empty for the provider's official URL; set a custom OpenAI-/Anthropic-compatible endpoint URL here.",
  'tiers.field.model': 'Model',
  'tiers.field.credKey': 'Credential',
  'tiers.field.temp': 'Temperature',
  'tiers.field.max': 'Max tokens',
  'tiers.unset': 'unset',
  'tiers.save': 'Save',
  'tiers.saving': 'Saving…',
  'tiers.saved': 'Saved',

  // ---- CredentialsSection ----
  'vault.loading': 'Loading credentials…',
  'vault.empty': 'No credentials yet.',
  'vault.hint': 'Credential values can be viewed — keep them safe and do not share them.',
  'vault.new': 'New credential',
  'vault.closeForm': 'Close form',
  'vault.titlePlaceholder': 'Title (e.g. deepseek)',
  'vault.valuePlaceholder': 'Value (API key…)',
  'vault.show': 'Show',
  'vault.hide': 'Hide',
  'vault.saving': 'Saving…',
  'vault.save': 'Save',
  'vault.deleteAria': 'Delete credential {name}',
  'vault.deleteConfirm': 'Delete this credential?',
  'vault.delete': 'Delete',
  'vault.keep': 'Keep',

  // ---- PatternsTab ----
  'patterns.closeForm': 'Close form',
  'patterns.new': 'New pattern',
  'patterns.namePlaceholder': 'Pattern name',
  'patterns.tierAria': 'Model tier',
  'patterns.creating': 'Creating…',
  'patterns.create': 'Create pattern',
  'patterns.loading': 'Loading patterns…',
  'patterns.empty': 'No patterns. Create one before opening a session.',
  'patterns.deleteAria': 'Delete pattern {name}',
  'patterns.deleteConfirm': 'Delete this pattern?',
  'patterns.delete': 'Delete',
  'patterns.keep': 'Keep',

  // ---- TasksTab ----
  'tasks.back': '← Back to tasks',
  'tasks.source': 'Source',
  'tasks.target': 'Target',
  'tasks.created': 'Created',
  'tasks.updated': 'Updated',
  'tasks.parameters': 'Parameters',
  'tasks.dependencies': 'Dependencies',
  'tasks.cancelConfirm': 'Cancel this task?',
  'tasks.cancelling': 'Cancelling…',
  'tasks.cancelTask': 'Cancel task',
  'tasks.keep': 'Keep',
  'tasks.refresh': 'Refresh',
  'tasks.loading': 'Loading tasks…',
  'tasks.empty': 'No tasks. The backend creates them as the agent works.',
  'tasks.colId': 'ID',
  'tasks.colType': 'Type',
  'tasks.colStatus': 'Status',
  'tasks.colCreated': 'Created',

  // ---- CodeHighlight ----
  'code.copy': 'Copy',
  'code.copied': 'Copied',

  // ---- Client-generated errors ----
  'error.backendUnreachable': "Can't reach the backend on port {port}. Check the port and start veto-core, then try again.",
  'error.requestFailed': 'Request failed (HTTP {status})',
  'error.promptCancelled': 'Cancelled. The agent may still finish this run on the backend.',
  'error.backendRestarted': 'Backend restarted — sign in again.',
  'error.passwordTooShort': 'Password needs at least {min} characters.',
} as const;

export type MessageKey = keyof typeof en;
