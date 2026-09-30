import { initializeDiagnostics } from './features/runtime/frontend-diagnostics';
import { version } from '../package.json';

// Next executes this before hydration. Native fixed-code IPC audit remains intact.
initializeDiagnostics(version);
